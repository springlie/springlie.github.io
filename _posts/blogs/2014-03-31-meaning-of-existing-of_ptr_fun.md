---
layout: post
title: ptr_fun存在的意义
category:
tag: c++, stl, func_ptr, functor, ptr_fun
description: 转载本文请署名并注明来源
disqus: true
permalink: /blogs/meaning-of-existing-of_ptr_fun
---

众所周知，在c++的世界里，一共有三种调用函数的方式：

1. 对于普通函数foo:				foo(args);
2. 对于对象obj的成员foo:		obj.foo(args);
3. 对于对象指针p的成员foo:		p->foo(args);

下面以for_each为例进行分别分析：

#####sort

for_each函数接受三个参数，前两个是迭代器，指明某一段序列，第三个是一个一元函数，用以作用于前两个参数指明的序列区间上。

	Operator for_each(Iterator begin, Iterator end, Operator unary-func);

这里的unary-func可能是上述三种形式的任何一种。

同时，由于我们在for_each过程中想要持有一些过程中的变量，因此，functor也是被支持的。形如：

	bool for_each(Iterator begin, Iterator end, Operator functor){...};

其中functor是一种特殊的对象，其拥有一个unary-func的成员函数operator()，这使得functor的调用行为与unary-func相似，但因为functor是一个对象，因此它获得了拥有其他方法和变量的能力。

待续。。。
