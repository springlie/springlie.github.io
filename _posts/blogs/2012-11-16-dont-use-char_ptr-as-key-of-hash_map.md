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

同事前几天用`hash_map`时发现一些问题。当时的场景是有一些字符串`char*`，要去对应某种类型的对象。同事的做法是：

- 尝试用`char*`作为key进行hash。编译通过，但运行时不正常，`insert`操作可以成功，但`find`操作基本都失败
- 改用`string`将原字符串包装后作为key进行`hash`。编译时不能通过
- google后，用`string`作key，并添加了一个`template<> struct hash< std::string >`的仿函数作为`hash_map`的构造参数。编译通过，运行正常，但不知原委为何

#分析

---

带着这三个问题去查看了libstdc++中关于`hash_map`的实现(省略了与讨论无关部分)：

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

line 3~5 可见，`hash_map`是个模板类，定义了5种参数类型，分别是

- key的类型`_Key`
- 值的类型`_Tp`
- hash仿函数`_HashFn`，用于执行真正的`hash`操作。有默认模板参数`hash<_Key>`
- 比较仿函数`_EqualKey`，用于执行`hash`冲突后，bucket内的`find`工作。有默认模板参数`equal_to<_Key>`
- 内存分配器。有默认模板参数参数

line 8~12可见，`hash_map`中包含了一个`hashtable`对象，`hashtable`也是个模板类，有6个参数类型，参数的具体类型在`hashtable.h`中，分别是

- `hash_table`中储存的值的类型`_Val`，实际对应`hash_map`中的`pair<const _Key, _Tp>`
- Key的类型`_Key`
- hash仿函数
- 从pair对象中分离出key对象的仿函数`_ExtractKey`
- 比较仿函数`_EqualKey`
- 内存分配器

line 16~23可见，`hash_map`其实是对`hashtable`的包装，其初始化、`find`与赋值操作都是由内部的`hashtable`对象来完成的。

`hashtable`的具体实现是：

1. 由一个bucket数组组成
2. 每个bucket下面挂着一个hash_node组成的list
3. 每个hash_node由一个`_Val`对象(存储真正元素)和一个`hash_node`指针(next指针)组成

hashtable的工作过程是：

1. 将key用`_HashFn`进行hash
2. 将hash的结果执行取模操作%n(其中n是hashtable中bucket的数目)，定位到具体bucket的位置
3. 依次用`_EqualKey`比较bucket中`hash_node`的key，找到与输入元素相同的node，返回；若找不到，则构造一个node返回

---

下面来回答篇首提出的三个问题:

	为什么用`char*`(或`const char*`)作为key，可以顺利insert，却不能顺利find？

因为`insert`时，会将`char*`指针进行`hash`，默认的内置hash函数接受`char*`作为参数，并将所指字符串进行`hash`，直到串尾。因此可以顺利找到bucket，但在进一步查找比对key时，用的是`equal_to<char*>`函数，它是直接比对指针的！一般来说，进行`insert`操作时，指针是不相同的，因此每次`insert`都生成新的node返回，`insert`正确。用`size()`方法也可以验证到，确实能够`insert`成功。

而在`find`操作中(假设用来insert的key已经在`hash`表中，本应可以命中的)，同理可以找到bucket，但是在比对key时用的是char*指针，而实情却是char*所指的内容相同！但`equal_to<char*>`不会理会这些，它只是傻傻比对指针，因此基本不会找到结果。(假如可以找到结果，那就是`hash`表中存的`char*`和你输入的`char*`正好相同)

	为什么改用`string`作为key，会无法通过编译？

因为默认的内置`hash`函数不接受`string`作为参数，也就是说，没有`hash(string str)`或者`hash(const string& str)`这种特化存在。其实，hash函数支持的函数是相当有限的，仅有`char`、`int`、`long`以及它们的`const`和`unsigned`版本，指针类型更是只支持`char*`！

	为什么加上`template<> struct hash< std::string >`的实现，就可以编译并执行正确？

首先加上这个`hash`后，`hash`函数能够处理`string`参数，并正确找到bucket，在比对key环节，用的是默认的`equal_to<string>`，而这个函数可以正确来比对字符串而不是比对指针，因此`insert`和`find`都能成功。

#总结

---

至此，总结下以后遇到这种情况怎么办。有两种方法：

1. **写一个关于字符串的比较函数(类似于`strcmp`就可以)，构造`hash_map`时传进去，保证在key比对时不是对比较指针而是比较字符串**
2. **写一个接受`string`类型的hash函数，保证`hash`时`string`参数能被正确处理**

#转折

---

事情到此时貌似已经圆满了。连[《STL源码剖析》](http://www.amazon.cn/STL%E6%BA%90%E7%A0%81%E5%89%96%E6%9E%90-%E4%BE%AF%E6%8D%B7/dp/B00116JFS0/ref=sr_1_1?s=books&ie=UTF8&qid=1378731553&sr=1-1&keywords=stl%E6%BA%90%E7%A0%81%E5%89%96%E6%9E%90)P278也说这样OK。但是……真的是这样吗？char*真的能用来作`hash_map`的key吗？

答案是**不可以**！！！

这里存在一个巨大的隐患：

hash表中存储的永远是`pair<_Key, _Tp>`，如果用`char*`作key，则存储的key只能是`char*`。这里就涉及到一个内存管理的问题，你要确保之前`insert`时用的`char*`不能失效，而且内容不能被更改。否则在bucket内比对key时就会出现严重的问题，轻则找不到元素，甚至core掉。

即使是用`const char*`作key同样不安全，因为一旦`const char*`的生命期比`hash_table`短，那么`hash_table`中相应的key就已变为野指针。

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

- **不用`char*`或`const char*`作为`hash_map`的key**。用`string`包装并代替它，同时为hash仿函数添一个`string`的特化版本
- **一定要用`char*`的话，请用`const char*`，还要保证在`hash_map`的生命周期里，曾经insert过的`const char`指针不要变成野指针**
- **尝试用`unordered_map`代替`hash_map`**。首先它原生支持`string`，其次有效率优势，再次已经成为新标准，便于扩展。`hash_map`已经被放到backward里
