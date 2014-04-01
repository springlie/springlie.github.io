---
layout: post
title: auto_ptr的copying函数的一点思考
category:
tag: c++, auto_ptr, stl, auto_ptr_ref
description: 转载本文请署名并注明来源
disqus: true
permalink: /blogs/auto_ptr-copying-member-function
---

#题外话

---

- 如果某函数接受的参数不是期待的类型，编译器会尝试进行隐式的转换。将传入参数进行适配，使得函数调用能够成功
- 这样的隐式的转换只能进行一次。编译器不可能先将`TypeA`隐式转换为`TypeB`，接着又把`TypeB`隐式转换为`TypeC`

下面一段代码验证了这两个行为：

```cpp
struct A
{
    int _m;
    A():_m(0){};
};

struct B
{
    A _m;
    int _alias;
    B(A a):_m(a),_alias(0){};
};

struct C
{
    B _m;
    C(B b):_m(b){};
};

struct D
{
    C _m;
	D(C c):_m(c){};
};

A a;
B b(a);
C c1(b), c2(a), c3 = C(a);
// C c4 = a;
// D d1(a);
D d2(b);
```

对象a、b和c1创建时没有隐式转换。
对象c2和c3创建时，编译器将参数a隐式转换为一个临时的`TypeB`对象；d2创建时，编译器将参数b隐式转换为一个临时的`TypeC`对象。
对象c4不能被创建，因为编译器并不负责两次隐式转换(`TypeA` -> `TypeB` -> `TypeC`)；同样d1也不能创建同样是因为需要两次隐式转换(`TypeA`->`TypeB`->`TypeC`)。
另外，copying函数指的是拷贝构造函数和赋值函数。

#问题

---

今天看[《C++标准程序库：自修教程与参考手册》](http://www.amazon.cn/mn/detailApp/ref=asc_df_B0011BDOM8473060/?asin=B0011BDOM8&tag=douban-23&creative=2384&creativeASIN=B0011BDOM8&linkCode=asn)中关于`auto_ptr`的部分，提到它的copying函数只能用`auto_ptr`作参数，不能用普通指针。请看一下代码所表现的：

```cpp
#include <memory>
using namespace std;

class A
{
};

auto_ptr<A> pa(new A);
auto_ptr<A> pb = pa;
auto_ptr<A> pc = auto_ptr<A>(new A);
// auto_ptr<A> pd = new A;
```

pb和pc可以被`auto_ptr<A>`正确赋值，而pd不能被普通指针`A*`赋值。

这里涉及到的问题有两个：

- 为何要规定这种行为？
- 在内部如何去实现？

#分析

---

第一个问题比较明了，因为`auto_ptr`中有“资源所有权”的问题，每时每刻，某一个资源(比如一块内存神马的)只能属于一个`auto_ptr`，因此在它的copying函数实现中，必定会包含有资源所有权转移的代码。而普通指针并没有所有权的概念，当然不能被作为copying函数的参数。这种行为肯定是应该禁止的。

而要回答第二个问题，请先看看本文开头描述的两种行为中的第一种，按说，在`auto_ptr_copying`中的pd被赋值时，new A应该可以由编译器隐式转换为`anto_ptr<A>`类型的，怎么就失败了呢！ 打开`auto_ptr`定义所在stl中的memory文件，源码是这样的：

{% highlight cpp loinenos %}
template<typename _Tp>
    class auto_ptr
    {
    private:
      _Tp* _M_ptr;

    public:
      /// The pointed-to type.
      typedef _Tp element_type;

      /**
       *  @brief  An %auto_ptr is usually constructed from a raw pointer.
       *  @param  p  A pointer (defaults to NULL).
       *
       *  This object now @e owns the object pointed to by @a p.
       */
      explicit
      auto_ptr(element_type* __p = 0) throw() : _M_ptr(__p) { }

      // other source code
      // ......
    }
{% endhighlight %}

注意第17行上的修饰构造函数的`explicit`关键字，它规定`auto_ptr`的构造函数不能参与隐式转换(在隐式转换时禁止调用)，只能显式进行转换，因此在`auto_ptr_copying`中没有隐式转换。问题貌似到此已经清楚了。

那么，如果不计后果地把这个`explicit`给去掉呢？是不是就可以进行隐式转换了？结果是否定的。

`auto_ptr`的copying函数大有玄机，回头看看本文开头描述的两种行为中的第二种，再结合[这篇专门讲述`auto_ptr_ref`的文章](http://www.iteye.com/topic/746062)，应该就豁然开朗了！
