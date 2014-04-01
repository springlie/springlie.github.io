---
layout: post
title: 通过mmap加速文件读写
category:
tag: mmap, munmap
description: 转载本文请署名并注明来源
disqus: true
permalink: /blogs/use-mmap-to-accelerate-file-reading-and-writing
---

`mmap`是内存映射相关的系统调用。

通过`mmap`，可以将进程地址空间与内核中的地址空间建立联系，减少读写过程中用户/内核状态切换与数据copy。

与普通I/O相比，`mmap`的优点在于：

1. 建立了内存映射，不需要`read`、`write`时多余的缓存区copy
2. 由于内存映射的存在，避免了用户/内核态的切换
3. `mmap`可以作为一种多进程共享内存的机制
4. 减少系统调用`lseek`，而直接用指针操作代替

同时，`mmap`也有一定的缺点：

1. 建立内存映射时会按页对齐，假如文件非常细碎，积累效应会导致有内存浪费
2. 大量细碎小文件会使进程地址空间产生大量碎片，导致寻址时间逐渐变长
3. 如果初次`mmap`时映射的大小不够，则需要通过`mremap`增大映射空间，可能会带来额外的时间损耗

下面

	rxs_util.h

```cpp
#ifndef RXS_UTIL_H
#define RXS_UTIL_H

#include <string>
#include <vector>

using std::string;
using std::vector;

class rxs_util
{
private:
    rxs_util(){};
    ~rxs_util(){};

public:
    typedef enum mmap_mode_t
    {   
        MODE_TO_READ = 0,
        MODE_TO_WRITE,
        MODE_NUM
    }mmap_mode_t;

    static bool mmapfile(const string& file, char* &ptr, int& len,  mmap_mode_t mode = MODE_TO_READ);
    static bool munmapfile(char* &ptr, int len, mmap_mode_t mode = MODE_TO_READ);
};
```

	rxs_util.cc

```cpp
#include <sys/types.h>                                                                                                                 
#include <dirent.h>                                                                                                                    
#include <sys/stat.h>                                                                                                                  
#include <fcntl.h>                                                                                                                     
#include <sys/types.h>                                                                                                                 
#include <unistd.h>                                                                                                                    
#include <sys/mman.h>                                                                                                                  
#include <stdio.h>

#define error_msg(fmt, args...)                         \
do{                                                     \
	fprintf(stderr, "\033[1;31;40m");                   \
	fprintf(stderr, "%-7s%-4s", "error", "-->");        \
	fprintf(stderr, fmt ,##args);                       \
	fprintf(stderr, "\033[0m\n");                       \
}while(0)

#define error_log(str)                                  \
do{                                                     \
	fprintf(stderr, "\033[1;31;40m");                   \
	fprintf(stderr, "%-7s%-4s", "errlog", "-->");       \
	fprintf(stderr, "file:%s line:%d| function:%s| ",   \
			 __FILE__, __LINE__, __func__);             \
	fprintf(stderr, "\n%11cdetail:", ' ');              \
	perror(str);                                        \
	fprintf(stderr, "\033[0m");                         \
}while (0) 

bool rxs_util::mmapfile(const string& file, char* &ptr, int& len, const mmap_mode_t mode)                                              
{                                                                                                                                      
    int fd_mode, mmap_mode, fd;
                                                                                                                                       
    if(MODE_TO_READ == mode)                                                                                                           
    {                                                                                                                                  
        fd_mode = O_RDONLY;
        mmap_mode = PROT_READ;                                                                                                         
        fd = open(file.c_str(), fd_mode);                                                                                              
    }                                                                                                                                  
    else                                                                                                                               
    {
        fd_mode = (O_RDWR | O_CREAT | O_TRUNC);                                                                                        
        mmap_mode = PROT_WRITE;                                                                                                        
        if(rxs_util::touch_dir(file))
        {                                                                                                                              
            fd = open(file.c_str(), fd_mode, 0644);                                                                                    
        }                                                                                                                              
        else
        {                                                                                                                              
            fd = -1;
        }
    }

    if(0 > fd)
    {
        error_log("open file error");

        return false;
    }

    if(MODE_TO_READ == mode)
    {
        len = lseek(fd, 0, SEEK_END);
        if(0 == len)
        {
            error_msg("empty file %s found", file.c_str());

            return false;
        }
    }
    else
    {
        // insert "" at tail for fixing "Bus error" bug
        lseek(fd, len - 1, SEEK_SET);
        write(fd, "", 1);
    }

    ptr = (char*)mmap(NULL, len, mmap_mode, MAP_SHARED, fd, 0);
    close(fd);

    if(ptr == MAP_FAILED)
    {
        error_log("mmap error");
        error_msg("name=%s, len=%d, fd=%d, mode=%d, mmap_mode=%d", file.c_str(), len, fd, mode, mmap_mode);

        return false;
    }
    else
    {
        return true;
    }
}

bool rxs_util::munmapfile(char* &ptr, int len, mmap_mode_t mode)
{
    if(MODE_TO_WRITE == mode)
    {
        if(0 != msync(ptr, len, MS_SYNC | MS_INVALIDATE))
        {
            error_log("msync error");
        }
    }

    if(munmap(ptr, len) != 0)
    {
        error_log("munmap error");

        return false;
    }

    ptr = NULL;

    return true;
}
```

以上代码定义了基于`mmap`的两种模式：`MODE_TO_READ`、`MODE_TO_WRITE`，以此来达到快速读写文件的功能。

