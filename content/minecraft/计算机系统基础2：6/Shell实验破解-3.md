---
日期: 2026-08-03
网址: shell-over-3
蓝图: Shell实验破解-3
---

# Shell实验破解-3
>trace03继续。别忘了解题思路的循环。
```C
看trace-->找sdriver.pl-->改tsh.c-->make、反复调试
```
## Trace03
![[Pasted image 20260803123459.png|408]]
trace03 的要求是：`#运行前台作业`，两行都是shell命令，会直接传给shell。
1、第一行运行一个给定路径的echo程序，我们的`exevce()`已经可以实现。
2、第二行，是运行内置的quit指令，我们的早已实现。
说明trace03是送我们的，直接make、make test03、make rtest03验证吧
![[Pasted image 20260803123846.png|411]]
## Trace04
![[Pasted image 20260803123936.png|408]]
trace04要求：`#运行后台命令`,两行都是shell命令、直接传给shell。
1、第一行同trace03，echo，已经实现
2、第二行是运行一个后台程序。那无论前台、后台，他们都通过`exevce()`来运行啊。所以我们已经可以实现。
直接make验证：
![[Pasted image 20260803124449.png|392]]
出问题了， 标准输出还要求输出一行这个后台作业的情况。问题来了，我们压根就没有记录所有运行的作业(job)。
咋记录？看看我们有什么工具呢？[[Shell实验破解-2]]中的`工具函数表`还记得吗？
于是我们很快联想到：
```C
我们需要利用作业列表(jobs List)来记录下来我们所有的作业的信息。
jobs是已经初始化好的
addjob(jobs,pid,state,cmdline)可以把用cmdline命令添加、PID=pid、state确定的一条作业的情况，加入jobs List。
```
补充好后台作业处理的代码。(都是`eval()`的一部分)
```C
//父进程后台作业的处理
if(bg == 1){
	addjob(jobs,pid,BG,cmdline); //之前已经初始化了jobs清单，可以直接用,BG表示后台作业
	printf("[%d] (%d) %s",pid2jid(pid),pid,cmdline);//输出到屏幕上
}
```
同时，我们联想到，前台作业也需要记录，但不打印。把BG换成FG。加上`addjob()`
```C
//父进程前台作业的处理
if(bg == 0){
	addjob(jobs,pid,FG,cmdline);
}

```
好，make、测试！
![[Pasted image 20260803130325.png|471]]
我们发现非常奇怪的现象——如上。
1️⃣我的job编号为啥是2？？，意思是还有一个job存在咯？
2️⃣为啥输出的顺序还颠倒了？？？
思考：
回顾全程，我们一共就运行了两行代码、对应两个进程。那么真相水落石出了：第一行的前台作业，子进程在运行完之后，就被终止了，而我没有回收、删除掉它！！所以会有两个进程。
这是谁的责任？？！！！进程终止后，操作系统发送SIGCHLD给父进程。父进程收到了SIGCHLD之后，自动调用sigchld_handler函数，没有发挥作用！！！！因为我们还没写😁
于是我们来完成它。
怎么回收？用`子进程监听函数waitpid()`啦！
![[Pasted image 20260803134147.png]]

我们目前只需要把所有的终止的进程自动回收，并且从jobs列表里面删除。用：
```C
void sigchld_handler(int sig)
{
    pid_t pid; //定义pid，用来接受waitpid的返回值
    while() (pid = waitpid(-1,NULL,0))>0){ //循环，只要还有进程就等待、回收
        deletejob(jobs,pid);
    };//回收所有被终止的进程
    return;
}

```
OK，1️⃣解决了，那么颠倒的问题呢？我们继续想这个过程。首先会有一个前台作业(对应echo进程)，还没等它运行完，这个时候，我们的shell就又运行了第二行代码，先输出了结果。也就是说，我们没有等待前台进程结束。
这是哪个函数的责任？`waitfg()`。
怎么写`waitfg()`？
❶判断一个进程是前台进程？我们现在每一个进程的状态都已经保存，存在了jobs表里。所以我们通过读表，就可以直到标志为FG的就是前台进程。可以直接从表里读前台进程的pid。正好有一个工具函数！`fgpid()`，
```C
(fgpid(jobs) == pid))就可以用作判断子进程是否占据前台
```
❷如果占据了前台，怎么做？等。
```C
sleep(1)
```
所以：
```C
void waitfg(pid_t pid)
{
	whlie(fgpid(jobs) == pid){
		sleep(1); //只要占据前台，就空运转着
	}
    return;
}
```
再测试！！
![[Pasted image 20260803140501.png|419]]
只有pid不一样，正常。因为操作系统每一次创建的进程都会 分配新的PID。
Trace04通过！
## Trace05
![[Pasted image 20260803140826.png|427]]
trace05要求：`#处理jobs内置命令`
之前4条命令都一样，运行外部程序、两个后台作业，我们都能处理。
关键是jobs，这也没有输出啊？我们回顾REAEME检索这个命令的作用，同时make rtest05看一下标准输出。
![[Pasted image 20260803141354.png|701]]
![[Pasted image 20260803141442.png|407]]
joibs和quit一样是内置函数，我们修改`builtin_cmd()`,仿照quit的处理，在检测到jobs的时候,罗列所有的jobs，我们看看有没有工具可以使用。！刚好，看来要用`listjobs()`辅助函数了！(养成先看看有没有现用工具的习惯，不要什么都想着自己造，会很累)
那简单了：
```C
int builtin_cmd(char **argv)

{
    /*quit内置命令，识别，并且处理*/
    if(strcmp(argv[0],"quit") == 0){
        exit(0);
        return 1;
    }
	/*jobs内置命令，识别，并且处理*/
	if(strcmp(argv[0],"jobs") == 0){
        listjobs(jobs);
        return 1;
    }

    return 0;     /* not a builtin command */

}
```
make、测试！
![[Pasted image 20260803142159.png|463]]
出问题了：
jobs显示没有进程，说明：进程已经被回收了，才运行jobs这个指令。我们的sigchld_handler 在回收的处理方面有问题。
回顾整个过程定位：

❶运行`./myspin 2 &`之后，会创建后台作业，写入jobs，JID=1。
❷顺带打印`[1] (52862) ./myspin 2 &`信息
🌟❗️❸`/bin/echo ...` ，创建前台作业，写入jobs，JID=2，很快执行完，子进程结束，操作系统发送SIGCHLD信号，触发`sigchld_handler()`，首先，回收`/bin/echo ...`进程、删除JID= 2的这个作业。然后，由于仍然存在进程(`./myspin 2 &`)，`waitpid()`还会等待、回收`./myspin 2 &`这个后台作业,苦苦等了两秒之后，才将它回收。而伴随着`./myspin 2 &`进程终止，操作系统又发送SIGCHLD信号，触发`sigchld_handler()`，这次，因为已经没有进程，所以就没有运行删除作业。
❹之后运行`./myspin 3 &`，创建后台作业，写入jobs，JID=1。
❺i打印`[1] (52862) ./myspin 3 &`信息
❻`/bin/echo jobs`，创建前台作业，写入jobs，JID=2很快执行完，子进程结束，操作系统发送SIGCHLD信号，触发`sigchld_handler()`,回收`/bin/echo jobs` 进程、删除JID=2的作业，然后由于还存在进程(`./myspin 3 &`)，故而`waitpid()`还会等待、回收它，苦苦3秒过后，才将它回收。删除了这个JID =1的作业，于是作业表为空。
❼运行jobs指令，打印了空的列表。

马萨卡，罪怪于sigchld_handler(,,0)这个选项“等待所有进程直到终止”的机制！所以我们换一个options，改成WNOHANG模式，这样，对于已经终止的进程，回收掉它。如果还有进程没有终止，不等待，立刻返回0。
```C
void sigchld_handler(int sig)
{
    pid_t pid; //定义pid，用来接受waitpid的返回值

    while ((pid = waitpid(-1,NULL,WNOHANG))>0){
        deletejob(jobs,pid);
    };//不等待，立刻回收所有被终止的进程
    return;

}
```
再make、make test05。
![[Pasted image 20260803152922.png|440]]
通过~😁
>下一节继续，trace06

