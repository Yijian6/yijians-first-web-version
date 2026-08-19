---
日期: 2026-08-01
蓝图: Shell实验目标、背景、工具分析
网址: shell-analyse-goal
---
```
# Shell实验目标、背景、工具分析
```
>有了之前的内容作为基础，我们现在就已经可以进入Shell实验的分析流程，并一步一步完成Shell(tsh.c)代码的补全工作了

完成任何一个确定性目标的最高效方式，就是盯准目标，确定起点，走直线。
解题也是如此。为了完成Shell实验，我们务必先要弄清楚自己的起点在哪里，目标是什么。
## ❶理清楚实验目标要做什么——通过Readme(名字都告诉你了，求求你阅读我!(Readme!))
### 0️⃣回顾一下，Shell的工作原理：
Shell 本身是一个**进程**，它在自己的那块内存里跑着一个无限循环。

每一轮循环做三件事：

1. **打印提示符**，等你输入命令
2. **读取**、**解析**你输入的命令
3. 调用 `fork()` 让操作系统**再开一个进程**，然后子进程调用 `execve()` 把自己变成你要运行的程序
>其中，命令可以是内置的命令，也可以是执行另一个程序文件。



### 1️⃣Readme告诉我们：`tsh.c(Tiny Shell.c)`就是我们要补全的Shell的程序文件。
补全之后，我们编译成`tsh`文件，就完成了目标，做成了一个==t==iny(极简的) ==sh==ell，名为`tsh`

以及，`tsh.c`中有了一部分已经完成的辅助函数和我们需要完成的7个函数。
以及也告诉我们了那七个空函数分别的作用：
```C
* eval：解析和解释命令行的主例程。 【70行】
//Shell就是主要的进程，可见这个是最主要的那个函数。

* builtin cmd：识别和解释内置命令：quit、fg、bg和jobs。【25行】
//识别一个命令是内置命令，大概需要我们比较字符串即可。

* do_bgfg：实现bg和fg内置命令。【50行】
//似乎是两个命令函数，但我们暂时不知道是干嘛的

* waitfg：等待前台作业完成。【20行】
//一个等待前台作业的函数，

* sigchld handler：捕获SIGCHILD信号。【80行】
//这是一个handler函数，可见，我们需要自定义收到SIGCHILD之后做的事情
//还记得吗，SIGCHILD是子进程状态发生改变的信号

* sigint handler：捕获SIGINT（ctrl-c）信号。【15行】
//这也是一个handler函数，我们需要自定义收到SIGINT之后做的事情，ctrl-c可以让操作系统向前台进程发送这个信号。

* sigtstp handler：捕获SIGTSTP（ctrl-z）信号。【15行】
//这也是一个handler函数，我们需要自定义收到SIGTSTP之后做的事情，ctrl-z可以让操作系统向前台进程发送这个信号。
```
我们大概知道了要完成的事情。
哦还有一点提醒别忘了，这实际上提前说了`make`这个工具的用法：
```C
每次修改tsh.c文件后，输入make以重新编译它。
```
### 2️⃣还有tsh实现规范，告诉我们最后要实现的标准、 特性
这需要我们最后再看，逐一比对是否完成了要求，所以现在大概扫一眼即可。

## ❷弄清楚我们的背景、起点、工具——Readme、tsh.c的所有函数、注释
### 1️⃣接着Readme还向我们解释了Shell在解析命令过程中的原理：
**命令行**(Command Line)中的所有以空格为分隔的字符，会以`argv[](Argument vector)`这样一个数组的形式作为参数传如Shell程序的函数，并统计`argc`如：
```bash
tsh>"/bin/ls" -l -d 
```
会变成：
```bash
argc = 3  #(argument counts)表示参数数量的一个变量
argv[0] = "/bin/ls"
argv[1] = -l
argv[2] = -d
```

### 2️⃣还有Shell内置的一些命令的作用：
```C
 jobs：列出正在运行、停止的作业

 bg <job>：将一个停止的后台作业更改为正在后台运行的作业。#background<>

 fg <job>：将一个停止或正在后台运行的作业更改为前台运行。#foreground<>

 kill <job>：终止一个作业。
 
```
### 3️⃣Readme中最关键的部分来了，一些让我们检查工作的工具。
所谓，工欲善其事，必先利其器。理解清楚检查的工具，我们才有可能更大可能提高效率。所以这段要仔细读！有如下工具——
①参考实现：`tshref`(tsh reference)，是已经实现的tsh版本。我们的目标就是要让我们的`tsh.c`编译成`tsh`后实现一样的效果，(面对输入有同样的输出)

②Shell driver：`sdriver.pl`，顾名思义，Shell 的驱动器。这是一个用Perl语言写成的脚本，可以操控、执行Shell。那怎么操作呢？Readme说： ./sdriver.pl -h给了我们使用说明：

```bash
linux> ./sdriver.pl -h
Usage: sdriver.pl [-hv] -t <trace> -s <shellprog> -a <args>
#[]中的是可选参数，-t -s -a是必选参数
Options:
  -h Print this message   #-h可以查看帮助
  -v Be more verbose      #verbose是详细、详尽的意思，这个选项让输出更详尽
  -t <trace> Trace file   #-t参数需要提供一类Trace file，
						  # 指的大概是文件包里的trace0x.txt把
  -s <shell> Shell program to test #Shell程序文件，也就是tsh或tshref
  -a <args> Shell arguments        #Shell文件的参数，？不清楚，但后面好像有解释
  -g Generate output for autograder #？不清楚
```
③trace0X.txt：搭配`sdriver.pl`一起使用的**跟踪文件**，大概就指的是用于提供需要的`-t`参数了
❗️这里，README还补充了具体的使用方法，那既然是工具，最重要的部分就是这里了：
![[Pasted image 20260801200724.png]]
也就是说，通过这样一样命令，我们可以将`trace`提供给`sdriver.pl`，同时还告诉我们了这里（-a "-p"参数告诉您的shell不要发出提示符）
![[Pasted image 20260801200955.png]]
这一句话，“或者”一词说明：这个命令和上面那个长命令等价。同时，类比`make test01`可以将`trace01.txt`作为跟踪文件测试，`make test{1~16}`可以将1~16个trace文件分别测试
![[Pasted image 20260801201519.png]]

在测试的时候，我们加入一个r(reference)就能查看到标准输出的结果，用于和我们的结果进行比对，检验。
④`tshref.out`提供了参考实现在所有跟踪上的输出。就是说，这是一个输出的汇总文件而已。

后续的提示告诉我们一点方向、提醒：
```C
方向：
1、跟着trace01、02依次的指导来完成我们的代码。
所以我们之后的思路大概是：
①cat查看一下trace0x的文件，看它的作用，和sdriver共同作用能测试tsh的什么，
②然后我们改动tsh.c文件
③make编译
④make test0x并且make rtest0x，比较两者输出，保证一样
⑤重复这个循环，看下一个trace文件

提醒太多了，有些看得懂，有些看不懂，先跳吧。(后面再说)
```
最后，说明白了剩下一些我们不懂的c文件的作用：
```C
myspin.c        # Takes argument <n> and spins for <n> seconds
				这个程序接受一个参数<n>，空转<n>秒

  

mysplit.c       # Forks a child that spins for <n> seconds
				这个程序会fork一个子进程，子进程空转<n>秒

  

mystop.c        # Spins for <n> seconds and sends SIGTSTP to itself
				这个程序空转<n>秒之后，自己(调用操作系统)给自己发送SIGTSTP信号

  

myint.c         # Spins for <n> seconds and sends SIGINT to itself
				这个程序空转<n>秒之后，自己(调用操作系统)给自己发送SIGINT信号
```
OK,README 读完了。 
那最关键的问题来了，我们既然要跟着trace来逐步解题，肯定需要知道trace的原理啊！
那这个trace命令到底是作甚的？？？？我们不得不看看trace01.txt了！