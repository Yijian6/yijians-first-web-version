---
日期: 2026-08-01
蓝图: Shell实验破解-1
网址: shell-over-1
---
# Shell实验破解-1
>接上集，我们进入trace01.txt的分析
## Trace01

![[Pasted image 20260801203742.png|475]]
### 看注释(#标注的就是给人看的，人可以直接读懂的)

```
#Test01：在EOF处正确的终止
```
**EOF**(End of File)是标记多行文件输入结束的**符号**，看来第一关是想让我们控制`tsh`在输入结束的时候，成功终止。
那CLOSE、WAIT是干嘛的？？不知道啊？大概是，CLOSE关闭，给tsh一个EOF的终止符号，然后等待WAIT，看他是否终止？不知到啊？？但我们联想到既然`trace文件`会作为sdriver.pl的参数，那么这些符号的作用，一定在sdriver文件中有提到，我们直接打开它、搜索(快捷键Ctrl+F)！
![[Pasted image 20260801204447.png|484]]
如图，不仅有CLOSE、WAIT，还有一些未来我们可能用到的命令(Command)，以及上面是一些关于这个工具的注释，我们也一起看了。(还是那句话，既然是工具(工欲善其事、必先利其器)、既然是注释(给人看的)，那为什么不看呢？就算是英文，哪怕是日语我开着翻译也得看啊！！)
```
# The driver runs a student's shell program as a child, sends
# commands and signals to the child as directed by a trace file,
# and captures and displays the output produced by the child.
这一段，直接点明了sdriver.pl这一Shell驱动脚本的作用——它将shell程序作为自己的一个子程序来运行，按照trace文件的指导，给这个子程序(也就是shell)发送命令和信号，并且捕获这个子程序的输出(output)、展示出来。
```
哦！原来，trace文件里面的CLOSE、WAIT命令，就是给sdriver.pl的一个指导，sdriver.pl会按照这个指导，操控Shell完成指导中的命令，并返回Shell输出的结果。说白了，这sdriver.pl就是个工具人呗，传话筒罢了。
以及，下面这一段原文还解释了trace文件相关的格式：
```C
# Tracefile format:
# 
# The tracefile consists of text lines that are either blank lines,
# comment lines, driver commands, or shell commands. Blank lines are
# ignored. Comment lines begin with "#" and are echo'd without change
# to stdout. Driver commands are intepreted  by the driver and are not
# passed to the child shell. All other lines are shell commands and
# are passed without modification to the shell, which reads them on
# stdin. Output produced by the child on stdout/stderr is read by
# the parent and printed on its stdout.
tracefile有这样四类行： 
1、空行(没用)
2、注释行(给人看，但不会改变输出结果)(我们要读来增进理解)
3、Driver commands(不会传送给shell，只被driver翻译给shell)(从sdriver.pl来找)
4、shell commmands(直接传送给shell作为输入，不做任何改动)
```
这也让我们理解了：tracefile的构成，便于我们接下来分析其他的内容
哦哦，对了，我们要来看CLOSE、WAIT是传的什么话来着。
看这句：
```
CLOSE Writer (Sends EOF Signal to Child)
```
Writer是啥呀？继续搜索！
![[Pasted image 20260801205552.png|499]]
Perl语法我又看不懂，继续只看注释。Writer指向Child的stdin(standard input)，标准输入。原来如此，说白了，这里的CLOSE，就是把Shell的输入关了呗。和后面的解释一样：发送了EOF的符号。
然后WAIT就是等待终止。

直接懂了！
trace01指导sdriver关闭Shell，先发送EOF符号，然后等待终止。

那回顾我们的解题的整体思路流程：
```C
①查看一下trace0x的文件，看它的作用，和sdriver共同作用能测试tsh的什么，
②然后我们改动tsh.c文件
③make编译
④make test0x并且make rtest0x，比较两者输出，保证一样
⑤重复这个循环，看下一个trace文件
```
我们大概率要去改动tsh.c，直接打开看看吧——我天这是个好大的文件！
![[Pasted image 20260801210415.png]]
510行。。。。看完不如杀了我吧。。
依旧，傻子才看完呢，我直接搜索，先看注释！😁搜啥？EOF呗。
0秒找到，不解释。
![[Pasted image 20260801210637.png|481]]
>补充两个知识点：[[常用C标准库函数]]`feof()`、`fflush()`和`exit()`的作用

这你一看，`main()`函数的“读取命令行”的代码里赫然写着一个判断语句：如果输入(stdin)是EOF，立刻刷新输出(stdout)，然后退出(exit(0))，这不就是我想要实现的吗？绝了，trace01原来是白给的。

然后我们直接make test01(还记得这个指令吗？相当于执行了很长一串那个，把trace01.txt喂给sdriver.pl，运行我们的tsh，然后呈现输出。)
![[Pasted image 20260801211644.png|485]]
再make rtest01比对两次输出的结果(如上)
一毛一样。可见就是白给。

OK啊，我们说“行百里者半九十九”。我们既然已经完成了test01，也就是完成了大约百分之一。一半的实验我们已经完成了，嘻嘻！😁

休息一下~，trace01的小小闭环我已经跑通，剩下的，不过重复而已。
下一节我们继续攻克剩下的一半！

>总结一下，我们分析之后每一个跟踪文件的路径、思路：
❶查看trace0x.txt里的内容(注释、driver 命令、shell命令)，
	a.认真读注释，知道要做什么！
	b.通过搜索的方式快速定位driver命令，查看注释，知道对shell做了什么！
❷查看、改动tsh.c文件，使其符合上面的命令要求！
❸make、make test0x、make rtest0x，检验是否符合要求！
❹反复调试，确保两者结果一样，然后进入下一个trace！
