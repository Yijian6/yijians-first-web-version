---
日期: 2026-08-03
网址: shell-over-4
蓝图: Shell实验破解-4
---
# Shell实验破解-4
## Trace06
![[Pasted image 20260803153237.png|525]]
trace06要求：`#给前台job发送SIGINT，终止它`
参考输出是：
![[Pasted image 20260803154006.png|531]]
查阅sdriver.pl：
![[Pasted image 20260803153423.png|389]]
INT就是发送一个SIGINT终止信号给shell。所以我们要写的函数就是shell收到SIGINT之后，如何处理——`sigint_handler()` 函数
很简单：
❶获取现在的前台作业吧，`fgpid()`  = pid 
❷直接把对应pid的作业终止了就好，借助信号发送函数`kill(pid,SIGINT)`：
代码就是：
```C
void sigint_handler(int sig)
{
    pid_t pid;// 先定义pid，为了后续使用
    pid = fgpid(jobs); //获取现在前台的作业(因为我们要终止的是前台作业)
	
    if(pid != 0){
        kill(pid,sig);
    }
    return;
}
```
kill发送信号之后，子进程收到了SIGINT的信号，会立刻终止。操作系统检测到了子进程的终止，又会发送SIGCHLD信号给父进程，接下来，我们又需要在sigchld_handler中获取这这个进程被信号终止的信息，打印输出！
![[Pasted image 20260803154922.png|484]]
所以这个函数：
❶首先不能用NULL了，因为收到信号要保存状态。
❷要定义status，然后使用宏工具解析它
改动后如下：
![[Pasted image 20260803161105.png]]
make、测试！
![[Pasted image 20260803161007.png|353]]
通过！
## Trace07
![[Pasted image 20260803161311.png|371]]
要求`#确保SIGINT只给前台发送终止`
那我们上面的代码里，本身就写的是，对前台处理，压根不影响后台，如下：
![[Pasted image 20260803161444.png|440]]
所以直接测试、通过！
## Trace08
![[Pasted image 20260803161926.png|317]]
类比INT，现在要我们处理SIGTSTP信号。相对比较容易了。
`sigtstp_handler()`直接复制粘贴，同理可得:
![[Pasted image 20260803162919.png|307]]

而在给子进程发送了暂停信号后，子进程的状态发生改变()。操作系统会发送SIGCHLD给父进程，于是又进入`sigchld_handler()`这个函数。而`sigchld_handler()`对于暂停(SIGTSTP)的处理和终止(SIGINT)的区别在于：
❶需要加入对被暂停的进程的监听：也就是加入`WUNTRACED`这个选项。
❷将解析中断状态的宏工具换成解析暂停状态的`WIFSTOPPED()`和`WSTOPSIG()`
🌟❸还要另外处理：状态由运行变成暂停之后，需要设置、改变这个job的属性，而不能直接删除这个job。
呼之欲出，代码如下：
```  C

        //如果是被信号暂停的，获取暂停它的信号信息，打印情况，更改job的状态，不删除
       if(WIFSTOPPED(status)){
            printf("Job [%d] (%d) stopped by signal %d\n",pid2jid(pid),pid,WSTOPSIG(status));
            fflush(stdout);
			
            struct job_t *job =getjobpid(jobs,pid); 
			//根据工具库，getjob()函数可以帮助我们使用pid直接找到对应的哪个job
            if(job != NULL){
                job->state = ST;  //结构体使用->来访问并改变state。
            }
        }
```

嗯嗯，测试一下吧。
![[Pasted image 20260803170557.png|408]]
被卡死在了终端，无法正确终止退出。
？？？？？为什么？？？？
## 疑惑不解的时候，看提示
最开始的README有一部分注意、提示内容被我忽略掉了，因为当时对整个Shell的理解太浅，所以反而成为负担，但是现在就很有用了：
提示中有这样几句话，我们发现自己的代码中还没有用到：
### 第一：
![[Pasted image 20260804102158.png]]
### `setpgid(0,0)`用法补充
英文对应是：set process group id ,用来为子进程设置新的进程组。
1️⃣用在`fork()`之后的子进程内：可将子进程单独设置一个进程组，该子进程作为组长，组名PGID = 这个子进程的pid。
2️⃣从而再使用`kill()`函数时候，将参数改成`-pid`，可以向该进程所在的进程组都发送SIGINT和SIGTSTP。
提示告诉我们：否则sdriver.pl会报错！！
所以我们修掉这个bug
1️⃣如图改动
![[Pasted image 20260804102842.png|405]]
2️⃣检索所有的`kill(pid,sig)`，改成`kill(-pid,sig)`
![[Pasted image 20260804103042.png|413]]
看看问题解决了吗？
终于，一切顺利！
![[Pasted image 20260804103253.png|407]]


如果你仔细阅读提示还会注意到这样一个函数：
提示我们务必使用sigpromask来进行信号阻塞。
这个问题，在我的电脑环境当中没有发生。但随时可能发生在任何一台电脑上。
也是一个很严重的问题，我们单独用一篇文章讨论解决——[[竞态条件]]
由于它有点耽误主线，我就没把他放入整体的过程来。

>test08结束！下一节进入test09！
