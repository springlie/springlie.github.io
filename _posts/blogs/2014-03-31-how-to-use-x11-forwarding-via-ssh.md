---
layout: post
title: 如何设置X11通过SSH进行转发
category:
tag: x11, forwarding, ssh
description: 转载本文请署名并注明来源
disqus: true
permalink: /blogs/how-to-use-x11-forwarding-via-ssh
---

本文介绍如何配置sshd服务端以及客户端参数，来获得通过ssh进行X11转发。想要使ssh通道获得X11的转发功能，需要在服务端和客户端同时进行设置。

#服务端

服务端的配置位于`/etc/ssh/sshd_config`中，对该文件配置以保证服务端sshd服务可以进行X11转发。

确保该文件包含以下选项：

	X11Forwarding yes

修改该文件后需重启sshd服务：

	service sshd restart

#客户端

客户端有两种方法保证ssh可以进行X11转发:

####修改`/etc/ssh/ssh_config`或`~/.ssh/config`文件

前者是全局配置，后者为当前用户配置，二者都存在的情况下，后者会覆盖前者的配置。

有两个选项需要注意：

- ForwardX11

- ForwardX11Trusted

这两个选项的作用是互相有影响的，表现为：

| ForwardX11 | ForwardX11Trusted | ssh_mode  |
| :--------- | :---------------- | :-------- |
| no         | no                | disabled  |
| no         | yes               | disabled  |
| yes        | no                | untrusted |
| yes        | yes               | trunsted  |

对于ssh_mode的解释：

- disabled:	无法进行X11转发，**但可以通过ssh命令参数来提升获得转发的能力。**
- untrusted:通过不可信连接进行X11转发，该模式下，当前客户端默认为不可信客户端，它不信任sshd服务器。因此该客户端在服务器上的权限受限，并且无法通过该客户端修改X11显示的其他客户端。(当然，其他客户端也不能修改当前客户端！)**该模式下的客户端，也可以通过为ssh命令配置-Y参数提升为可信客户端。**
- trusted:	通过可信连接进行X11转发，该模式下，当前客户端充分信任sshd服务器，并拥有X11的完全控制权，这意味着它可以对其他显示X11的客户端进行修改。**该模式下的客户端，也可以通过为ssh命令配置-X参数降低为不可信客户端。**


####通过为ssh命令指定参数

为ssh命令指定特定的参数会影响当前客户端的模式。这种方式会覆盖前面配置文件中的设置。

| ssh_args | ssh_mode  |
| :------- | :-------- |
| ssh      | disabled  |
| ssh -X   | untrusted |
| ssh -Y   | trunsted  |

许多客户端无法在untrusted模式下正常工作。
