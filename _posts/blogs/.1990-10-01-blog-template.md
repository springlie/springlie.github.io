---
layout: post
title: 博客模版
category: 
tag:
description: 这是一个发表博客的模版
disqus: true
permalink: /blogs/blog-template
---
***你好，世界！我是一个基于Github的独立博客！***

{% highlight ruby %}
def show
  @widget = Widget(params[:id])
  respond_to do |format|
    format.html # show.html.erb
    format.json { render json: @widget }
  end
end
{% endhighlight %}
