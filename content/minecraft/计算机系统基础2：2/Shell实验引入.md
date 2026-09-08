---
日期: 2026-07-25
网址: before-shelllab
蓝图: Shell实验引入
---
# Shell实验引入

你不一定用过Windows系统电脑里的Power Shell(PS/Pwsh)或者MacOS系统的Bourne Again Shell(Bash)、Z shell(Zsh),但你大概率玩过这款游戏：
![[Pasted image 20260730123735.png|400]]
那么以下情形，就屡见不鲜了：
![[Pasted image 20260730124244.png|400]]
在 Minecraft中，你可以通过输入一条指令，来查看、设置、改变游戏中的参数，以实现“作弊”，美名曰“加快游戏进度”。
例如：
```C
/gamerole creative  #给自己设置创造模式
/time set day       #将时间设置为白天
/命令名 参数
```
这背后就离不开一个能够将你的命令**拆解、分析、并且执行相关程序的工具(也是程序)**，这个工具程序就是**Shell**。
## Shell是什么
Shell 是一个解析命令、根据命令启动相关程序的程序。

在Windows电脑上，你可以搜索(快捷键：Win+S)Windows Powershell，来打开这个程序，输入命令启动电脑操作系统中的相关程序。
![[Pasted image 20260730143438.png|300]]

## Shell的使用实践
![[Pasted image 20260730144515.png]]
打开PowerShell之后，会呈现这个界面，叫**终端(Terminal)**，它指的是**提供文本输入、显示输出的窗口**。其中运行的程序，就是PowerShell

`PS C:\Users\觉>`
这一行代码叫做**命令提示符**(prompt)，它会**提示**你所在的文件夹，“C:\Users\觉”，你可以在`>`这个**分割符**之后输入**命令**
其他的Shell也都类似：

1️⃣Linux的Bash
```C
yijian@Jue:~/re-lab/shelllab$
用户名 @主机名：当前目录     分割符(普通用户)

root@ubuntu:/home/jue#
用户名@主机名：/当前目录 分割符(管理员用户)
```
2️⃣MacOS的Zsh
```
jue@MacBook-Pro ~ $
用户名 @主机名：当前目录   分割符
```
其中`~`表示默认的个人目录

以Windows PowerShell为例，
Windows PowerShell当中的指令非常多、能全面操控电脑实现不同功能。
(这是它的官方文档~https://learn.microsoft.com/zh-cn/powershell/)
>从官方文档中，你可以全面、细致了解到它的所有用法。

我比较常用的一个是定时关机指令
```
shutdown [操作参数] [附加参数]
```
`[]`表示这类参数是可选的(也可以不选)
常见的操作参数、附加参数有：

| 操作参数 | 对应英文     | 作用  | 附加参数    | 对应英文 | 作用          |
| ---- | -------- | --- | ------- | ---- | ----------- |
| /s   | shutdown | 关机  | /t <秒数> | time | 运行时间为<秒数>之后 |
| /r   | restart  | 重启  | ……      |      |             |
| /a   | abort    | 取消  | ……      |      |             |
| ……   |          |     |         |      |             |
例如，你可以试试
```shell
shutdown /s /t 3600  #系统会弹出注销的弹窗，3600秒之后自动关机。
shutdown /a          #取消刚才设置的自动关机任务
```
## 最后，说回Shell实验
这是一个让我们亲手补全一个Shell背后的实现逻辑的实验。它回答了你对于Shell的所有疑问：
- PowerShell这个程序怎么解析我的`shutdown /s /t`这个命令的？
- 解析之后，又是怎么运行相关程序的？
- 我要是同时运行很多个程序怎么办？它会怎么管理？
- 我要是故意输入错误的命令，Shell又该如何应对呢？
在这个实验中，我们会用C语言，完成一个极简版的Shell程序(Tiny Shell 即：tsh)，亲手补全其中最关键的部分。
下一节见。我们一起创造一个属于自己的shell。





