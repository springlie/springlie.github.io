---
layout: post
title: 尽量不用char*作为hash_map的key
category:
tag: c++, template, stl, hash_map
description: 转载本文请署名并注明来源
disqus: true
permalink: /blogs/dont-use-char_ptr-as-key-of-hash_map
---

#引子

---

同事前几天用hash_map时发现一些问题。当时的场景是有一些字符串char*，要去对应某种类型的对象。同事的做法是：

- 尝试用char*作为key进行hash。编译通过，但运行时不正常，insert操作可以成功，但find操作基本都失败
- 改用string将原字符串包装后作为key进行hash。编译时不能通过
- google后，用string作key，并添加了一个template<> struct hash< std::string >的仿函数作为hash_map的构造参数。编译通过，运行正常，但不知原委为何

#分析

---

带着这三个问题去查看了libstdc++中关于hash_map的实现(省略了与讨论无关部分)：

{% highlight cpp linenos %}
// hash_map

template<class _Key, class _Tp, class _HashFn = hash<_Key>,
    class _EqualKey = equal_to<_Key>, class _Alloc = allocator<_Tp> >
    class hash_map
{
    private:
        typedef hashtable<pair<const _Key, _Tp>,_Key, _HashFn,
                _Select1st<pair<const _Key, _Tp> >,
                _EqualKey, _Alloc> _Ht;

        _Ht _M_ht;

        // ...

        hash_map()
            : _M_ht(100, hasher(), key_equal(), allocator_type()) {}

        // ...

        _Tp&
            operator[](const key_type& __key)
            { return _M_ht.find_or_insert(value_type(__key, _Tp())).second; }

        // ...
}
{% endhighlight %}

line 3~5 可见，hash_map是个模板类，定义了5种参数类型，分别是

- key的类型_Key
- 值的类型_Tp
- hash仿函数_HashFn，用于执行真正的hash操作。有默认模板参数hash<_Key>
- 比较仿函数_EqualKey，用于执行hash冲突后，bucket内的find工作。有默认模板参数equal_to<_Key>
- 内存分配器。有默认模板参数参数

line 8~12可见，hash_map中包含了一个hashtable对象，hashtable也是个模板类，有6个参数类型，参数的具体类型在hashtable.h中，分别是

- hash_table中储存的值的类型_Val，实际对应hash_map中的pair<const _Key, _Tp>
- Key的类型_Key
- hash仿函数
- 从pair对象中分离出key对象的仿函数_ExtractKey
- 比较仿函数_EqualKey
- 内存分配器

line 16~23可见，hash_map其实是对hashtable的包装，其初始化、find与赋值操作都是由内部的hashtable对象来完成的。

hashtable的具体实现是：

1. 由一个bucket数组组成
2. 每个bucket下面挂着一个hash_node组成的list
3. 每个hash_node由一个_Val对象(存储真正元素)和一个hash_node指针(next指针)组成

hashtable的工作过程是：

1. 将key用_HashFn进行hash
2. 将hash的结果执行取模操作%n(其中n是hashtable中bucket的数目)，定位到具体bucket的位置
3. 依次用_EqualKey比较bucket中hash_node的key，找到与输入元素相同的node，返回；若找不到，则构造一个node返回

---

下面来回答篇首提出的三个问题:

	为什么用char*(或const char*)作为key，可以顺利insert，却不能顺利find？

因为Insert时，会将char*指针进行hash，默认的内置hash函数接受char*作为参数，并将所指字符串进行hash，直到串尾。因此可以顺利找到bucket，但在进一步查找比对key时，用的是equal_to<char*>函数，它是直接比对指针的！一般来说，进行insert操作时，指针是不相同的，因此每次insert都生成新的node返回，insert正确。用size()方法也可以验证到，确实能够insert成功。

而在find操作中(假设用来insert的key已经在hash表中，本应可以命中的)，同理可以找到bucket，但是在比对key时用的是char*指针，而实情却是char*所指的内容相同！但equal_to<char*>不会理会这些，它只是傻傻比对指针，因此基本不会找到结果。(假如可以找到结果，那就是hash表中存的char*和你输入的char*正好相同)

	为什么改用string作为key，会无法通过编译？

因为默认的内置hash函数不接受string作为参数，也就是说，没有hash(string str)或者hash(const string& str)这种特化存在。其实，hash函数支持的函数是相当有限的，仅有char、int、long以及它们的const和unsigned版本，指针类型更是只支持char*！

	为什么加上template<> struct hash< std::string >的实现，就可以编译并执行正确？

首先加上这个hash后，hash函数能够处理string参数，并正确找到bucket，在比对key环节，用的是默认的equal_to<string>，而这个函数可以正确来比对字符串而不是比对指针，因此insert和find都能成功。

#总结

---

至此，总结下以后遇到这种情况怎么办。有两种方法：

1. **写一个关于字符串的比较函数(类似于strcmp就可以)，构造hash_map时传进去，保证在key比对时不是对比较指针而是比较字符串**
2. **写一个接受string类型的hash函数，保证hash时string参数能被正确处理**

#转折

---

事情到此时貌似已经圆满了。连[《STL源码剖析》](http://www.amazon.cn/STL%E6%BA%90%E7%A0%81%E5%89%96%E6%9E%90-%E4%BE%AF%E6%8D%B7/dp/B00116JFS0/ref=sr_1_1?s=books&ie=UTF8&qid=1378731553&sr=1-1&keywords=stl%E6%BA%90%E7%A0%81%E5%89%96%E6%9E%90)P278也说这样OK。但是……真的是这样吗？char*真的能用来作hash_map的key吗？

答案是**不可以**！！！

这里存在一个巨大的隐患：

hash表中存储的永远是pair<_Key, _Tp>，如果用char*作key，则存储的key只能是char*。这里就涉及到一个内存管理的问题，你要确保之前insert时用的char*不能失效，而且内容不能被更改。否则在bucket内比对key时就会出现严重的问题，轻则找不到元素，甚至core掉。

即使是用const char*作key同样不安全，因为一旦const char*的生命期比hash_table短，那么hash_table中相应的key就已变为野指针。

#验证

---

```cpp
#include <iostream>
#include <ext/hash_map>
using namespace __gnu_cxx;
#include <function.h>
#include <cstring>
using namespace std;

struct mystrcmp
{
    bool operator()(const char* s1, const char* s2)
    {
        return strcmp(s1, s2) == 0;
    }
};

int main()
{
    hash_map<char*, int, hash<char*>, mystrcmp> days;

    days["Mon"] = 1;
    days["Tue"] = 2;
    cout << "now there is " << days.size() << " in hash_map" << endl;

    days.clear();

    char mon[8] = {0};
    char tue[8] = {0};
    strcpy(mon, "Mon");
    strcpy(tue, "Tue");
    days[mon] = 1;
    days[tue] = 2;
    cout << "now there is " << days.size() << " in hash_map" << endl;

    char someday[8] = {0};
    strcpy(someday, "Mon");
    strcpy(mon, "Mon1");

    cout << "now there is " << days.size() << " in hash_map" << endl;
    cout << "Mon " << days[someday] << endl;
    cout << "now there is " << days.size() << " in hash_map" << endl;
}
```

	now there is 2 in hash_map
	now there is 2 in hash_map
	now there is 2 in hash_map
	Mon 0                       <<----这里竟然没有查找成功
	now there is 3 in hash_map	<<----而是执行了插入操作

#结论

- **不用char*或const char*作为hash_map的key**。用string包装并代替它，同时为hash仿函数添一个string的特化版本
- **一定要用char*的话，请用const char*，还要保证在hash_map的生命周期里，曾经insert过的const char指针不要变成野指针**
- **尝试用unordered_map代替hash_map**。首先它原生支持string，其次有效率优势，再次已经成为新标准，便于扩展。hash_map已经被放到backward里
