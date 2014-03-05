---
layout: post
title: 模板拷贝构造函数？
category:
tag: c++, template, template constructor
description: 转载本文请署名并标注出处
disqus: true
permalink: /blogs/template-copy-constructor
---

#问题

---

[exceptional-cpp]: http://www.amazon.cn/Exceptional-C-%E4%B8%AD%E6%96%87%E7%89%88-Herb-Sutter/dp/B0011BWWCG

在[《exceptional c++》][exceptional-cpp]一书中描述第5~6问题时，给出一个类`fixed_vector`的定义，其中包含了两个成员模板函数。

[《exceptional c++》][exceptional-cpp]说明：
	
- 这两个函数不能被作为拷贝构造函数和赋值函数，类型O不可能等于类型T
- 这两个函数也不能阻止编译器自动生成的默认拷贝构造函数和默认赋值函数。
- “由于模板构造函数永远都不能成为拷贝构造函数，因此它们的出现并不会妨碍在类中隐式地声明拷贝构造函数。”
- “模板构造函数，包括拷贝构造函数，将与其他构造函数一起，共同参与到重载解析中。”
- “并且，如果模板构造函数能比其他的构造函数提供更好的匹配，那么可以用它来对对象进行赋值。”	

具体代码如下：

```cpp
template<typename T, size_t size>
class fixed_vector
{
public:
	typedef T*       iterator;
	typedef const T* const_iterator;
	fixed_vector() { }
	template<typename O, size_t osize>
	fixed_vector( const fixed_vector<O,osize>& other )
	{
	 copy( other.begin(),
		   other.begin()+min(size,osize),
		   begin() );
	}
	template<typename O, size_t osize>
	fixed_vector<T,size>&
	operator=( const fixed_vector<O,osize>& other )
	{
	 copy( other.begin(),
		   other.begin()+min(size,osize),
		   begin() );
	 return *this;
	}
	iterator       begin()       { return v_; }
	iterator       end()         { return v_+size; }
	const_iterator begin() const { return v_; }
	const_iterator end()   const { return v_+size; }
private:
	T v_[size];
};
```

#论证

---

为了验证书中论述，写两个文件如下：

{% highlight cpp linenos %}
// myclass.h

#include "iostream"
using namespace std;
 
template<typename T>
class myclass
{
public:
	myclass(T para){};
private:
	template<typename O>
	myclass(myclass<O>& o){ cout << "in_member_template_cotr" << endl; }
};
{% endhighlight %}

在`myclass`中，专门将成员模板函数设为private，以测验它是否能够屏蔽默认拷贝构造函数。

```cpp
// main.cc
 
#include "myclass.h"
  
int main()
{ 
	myclass<float> mc_f(47.00);
	myclass<int> mc_i(47);

	// member_template_cotr_call, failed coz it's private
	// myclass<int> mc_i1(mc_f);

	// default_copy_cotr_call, failed ?
	myclass<int> mc_i2(mc_i);

	return 0;
}
```

编译结果：

> make
> g++ -o app main.cc
> myclass.h: In function ‘int main()’:
> myclass.h:11: error: ‘myclass<T>::myclass(myclass<O>&) [with O = int, T = int]’ is private
> main.cc:12: error: within this context
> make: *** [all] error 1

而将`myclass.h`中第13行改为

```cpp
	myclass(const myclass<O>& o){ cout << "in_member_template_cotr" << endl; }
```

编译链接通过，运行无任何输出（说明调用了默认拷贝构造函数）。

#结论

---

- **成员模板构造函数不能被当做拷贝构造函数，也不能阻止默认拷贝构造函数和默认赋值函数的生成。模板赋值函数亦然。**本例即为拥有成员模板函数，仍然调用了默认拷贝构造函数。
- **默认拷贝构造函数的类型为常引用const&。**一开始编译报错，是因为模板函数（接受非const参数）比默认拷贝构造函数（接受const参数）更符合调用的参数传递类型(一个非const参数)，因此编译器选择了它【参见结论第三条】，而模板函数本身可见性为private，因此报错。其参数加上const后，则编译器优先选用默认拷贝构造函数，通过。
- **重载函数选择(Overload resolution)动作要先于存取权限检查(access checking)。**编译器并不因为模板函数是private而在重载匹配选择时忽略它，可见是先进行重载选择，接下来判断可见性。
