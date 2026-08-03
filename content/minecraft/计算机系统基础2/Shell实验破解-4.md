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

而在给子进程发送了暂停信号后，子进程的状态发生改变()。操作系统会发送SIGCHLD给父进程，于是又进入`sigchld_handler()`这个函数。而`sigchld_handler()`对于暂停(SIGTSTP)的处理，和终止(SIGINT)的区别在于：
❶需要加入对被暂停的进程的监听：也就是加入`WUNTRACED`这个选项。
❷将解析中断状态的宏工具换成解析暂停状态的`WIFSTOPPED()`和`WSTOPSIG()`
🌟❸还要另外处理：状态由运行变成暂停之后，需要设置、改变这个job的属性，而不能直接删除这个job。



嗯嗯，测试一下吧😈。
![[Pasted image 20260803170507.png|442]]
通过了吗😈😈😈
![[Pasted image 20260803170557.png|408]]
这里要放一个😈表情包。你应该感应到不对劲了。
## 竞态条件(race condition)
如上两幅图，同样的代码，是我在不同时间运行的结果。图一，通过。图二却卡死在了



