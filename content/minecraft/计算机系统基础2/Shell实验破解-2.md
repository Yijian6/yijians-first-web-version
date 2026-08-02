---
日期: 2026-08-02
网址: shell-over-2
蓝图: Shell实验破解-2
---
# Shell实验破解-2
>从trace02开始，一直做完trace16
## 在此之前，我们再次回顾我们的最终目标——那7个函数，在解题效率方面，再怎么强调目标意识都不为过。
据此，我们每一次都去看看，要补充的函数是哪个或者哪些。
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
## trace02
 ![[Pasted image 20260802120405.png|532]]
 注释告诉我们，我们要“Process，处理”quit这个内置命令
 第4行的小写字符告诉我们，quit会被直接传入shell 中当作命令。
 首先，一定设计到的地方有`builtin_cmd`函数，我们应该是要在这里加入quit的处理方式。我们直接去看一眼`tsh.c`中相关的注释、代码。
![[Pasted image 20260802121144.png]]

## 找到了，注释说明了`builtin_cmd()`函数的功能：
 ❶输入：`argv[]`(argument vector)参数数组
 ❷处理：至少有：①如果用户输入built-in 命令，②立刻处理
 ❸输出：一个int类型的整数
	 如果不是builtin command，返回0。
### 思考：那很明显了，`builtin(argv)`起到的作用有两个：
	①识别内置命令
	②处理该命令
就`quit`而言，我们要
	①识别出来`quit`是内置命令
	②处理这个内置命令
❹写代码
	①识别直接用`strcmp(string1，string2)`(string compare)函数就可以,内部return 1;
	②执行quit命令，直接用exit(0)退出就可以。
❺示例代码如下：
```C
int builtin_cmd(char **argv)
{
	if(strcmp(argv[0],"quit"== 0))//argv[0]表示输入的第一个参数
	{
		exit(0); //处理quit的方式就是，直接退出
		return 1; //为了区别于不是内置命令的情况，我们返回1;
	}
    return 0;     /* not a builtin command *///如果不是内置命令返回0，
}
```
太对了，下一步是检验，一下，从`main()`函数开始，能不把`解析命令-识别内置命令-执行quit命令`串联起来。
耐下心来，从`main()`开始慢慢读吧~毕竟是最首先被执行的函数，不读main怎么可能做出题。
![[Pasted image 20260802122540.png|530]]
养成好习惯，先读注释，再读代码：也不长，我直接复制过来逐行读。看不懂是常态。千万不要慌。只要没有涉及到上面目标的7个函数，那都是现成给你的，又不要你敲出来，压根不慌。
```C
int main(int argc, char **argv)
{
//定义argc、argv,显然用来接受用户的输入用的。原理中我们提到输入会变成一个数组argv[]
    char c;
    char cmdline[MAXLINE];
    int emit_prompt = 1; /* emit prompt (default) */
	//前面几行定义变量，cmdline就是一行命令的意思
	//emit是发出的意思，Prompt是(命令)提示符，就是说设置了一个
	
    /* Redirect stderr to stdout (so that driver will get all output
     * on the pipe connected to stdout) */
    dup2(1, 2);
	//这个函数不太熟悉，但注释说了，把stderr(standard error)和stdout(standard output)通过一个管道链接起来，变成stdout。
    /* Parse the command line */
	//下面开始解析(Parse)命令行了，里面也没有看到我们要完成的7个函数，所以都是给我们看看而已，看不懂就跳过。
    while ((c = getopt(argc, argv, "hvp")) != EOF) {
        switch (c) {
        case 'h':             /* print help message */
            usage();
        break;
        case 'v':             /* emit additional diagnostic info */
            verbose = 1;
        break;
        case 'p':             /* don't print a prompt */
            emit_prompt = 0;  /* handy for automatic testing */
        break;
    default:
            usage();
    }
    }
//命令行的h、v、p三个选项，对应不同处理方式。
  

    /* Install the signal handlers */
//这里！注意，自定义了该进程收到三类信号时候的不同处理方式，分别是SIGINT、SIGTSTP、SIGCHLD。

    /* These are the ones you will need to implement */
//并且，三个自定义处理函数的内容，都需要我们完成。(目前trace还没用到，先不管)
    Signal(SIGINT,  sigint_handler);   /* ctrl-c */
    Signal(SIGTSTP, sigtstp_handler);  /* ctrl-z */
    Signal(SIGCHLD, sigchld_handler);  /* Terminated or stopped child */
	
	/* This one provides a clean way to kill the shell */
    Signal(SIGQUIT, sigquit_handler);
	//这个是已经写好的， kill shell的方法，自动调用，不管了。
    /* Initialize the job list */
	//初始化jobs这个列表，调用了一个函数，这个函数不属于我们要完成的那7个以内的，那就是已经自己写好的。不管。
    initjobs(jobs);

	/* Execute the shell's read/eval loop */
//进入读取、解析、执行的核心内容了，但我们依旧，只关心那7个函数。
    while (1) {
    /* Read command line */
    if (emit_prompt) {
        printf("%s", prompt);  //打印提示词:tsh>
        fflush(stdout);
    }
    if ((fgets(cmdline, MAXLINE, stdin) == NULL) && ferror(stdin))
        app_error("fgets error");
    if (feof(stdin)) { /* End of file (ctrl-d) */
        fflush(stdout);
        exit(0);  //好眼熟，这不是上一题用到的地方吗
    }
    /* Evaluate the command line */
	这里进入执行阶段
    eval(cmdline);
	//将cmdline(一开始定义的这个表示用户输入的一行命令的字符数组)扔给eval处理
    fflush(stdout);
	//刷新输出，直接打印？？？这哪来了，eval没处理，我怎么打印啊？？
	//可见，我们下一步必须要完成eval()函数，将cmdline的命令解析、并处理了
    fflush(stdout);
	//再一次确保输出刷新成功
    }
    exit(0); /* control never reaches here */

}
```

读完了！整个main函数，涉及到重要的入口`eval()`函数。就是我们下一步要去看的！
直接搜索！第一次出现就在main上面的函数声明区，我们来看看
![[Pasted image 20260802122858.png|380]]
 可以看到，main函数上面有一大堆的函数声明，似乎我们都看不太懂。但，可以先看看注释：`Here are ……`
哦~明白了，Function prototype告诉我们函数分两类：
①you will inplement (你来完成)：
	我们可能需要分别搜索跳转过去再看看他们的注释、详细用法。
	务必仔细研磨，一字不落，毕竟《解题之道，就在其中》.

②helpers we provided(帮你实现)：
	这么多函数，原来都是"helper",也就是，早就已经实现的工具啊。那我们也要跳转过去，尽可能看看注释，了解他们做什么即可。
	先从名字大概看看吧，毕竟《工欲善其事，必先利其器》：
	有如下这么多辅助工具：我用表格简单整理罗列下他们注释里可以看到的简单用法

| 工具函数                | 英文名字拆解                | 注释提到的用法                                              | 输入                                        | 输出                          |
| ------------------- | --------------------- | ---------------------------------------------------- | ----------------------------------------- | --------------------------- |
| `parseline()`       | parse line<br>(解析,行)  | ①解析命令<br>②构建`argv[]`这个数组                             | ①cmdline(一行命令)   <br>②argv数组              | 后台命令返回1         <br>前台命令返回0 |
| `sigquit_handler()` | sig quit handler      | ①driver给shell<br>发送SIGQUIT信号后，终止shell                | ①sig                                      | 无                           |
| `clearjob()`        | clear 清空<br>job    作业 | ①把job的所有东西清空                                         | ①job 一个作业                                 | 无                           |
| `initjob()`         | initialize<br>初始化     | ①给job 清单初始化                                          | ①jobs 清单                                  | 无                           |
| `maxjid()`          | max 最大<br>jid 作业ID    | ①返回最大已分配的id                                          | ①jobs 清单                                  | 最大jid                       |
| `addjob()`          | add 增加                | ①给jobs 清单增加一项PID = pid ，状态 = state，用命令=cmdline添加的job | ①jobs 清单<br>②增加的pid<br>③state<br>④cmdline |                             |
| `deletejob()`       | delete 删除             | ①从jobs 清单删除PID = pid 的job                            | ①                                         |                             |
| `fgpid()`           | fg：foreground         | ①获取jobs清单中所有状态为fg的(占据终端的)前台任务的 pid                   | ①jobs清单                                   | job的地址                      |
| `getjobpid()`       | get 获取                | ①找到jobs清单中PID = pid的job                              | ①jobs清单<br>②pid                           | job的地址                      |
| `getjobjid()`       |                       | ①找到jobs清单中JID = jid的job                              | ①jobs清单<br>②jid                           | job的地址                      |
| `pid2jid()`         | 2 = to 转换             | ①根据进程的pid，得到对应job的jid                                | ①pid                                      | job的jid                     |
| `listjobs()`        | list 罗列               | ①打印jobs清单的所有项                                        |                                           |                             |
| `unix_error()`      | unix 操作系统<br>error 错误 | ①发生操作系统错误的处理例程                                       |                                           |                             |
| `app_error()`       | application<br>应用程序   | ①发生用户程序错误的处理例程                                       |                                           |                             |
| `Signal()`          |                       | 熟悉的自定义信号处理函数                                         |                                           |                             |
|                     |                       |                                                      |                                           |                             |

工具大概就扫完了，在实际过程中不用细看，了解关键词就好、比如说，
1、我知道`pid2jid()`可以实现转换jid和pid，所以我需要转换的使用，我就用这个。我压跟不知道原理也没关系。
2、我知道parseline可以解析命令行，我可能在处理解析的时候用得到，得到argv数组。
……

刚才说到，帮助函数只是小菜，我们更重要的要逐字细读7个要完成的函数的内容。回顾主函数，定义了一个 `cmdline`字符数组(作为输入)之后，就把它扔给了`eval()`，我们跳转去看看`eval()`的注释。
![[Pasted image 20260802123151.png|381]]
果然，函数内部是空的，完全需要我们来填写。
## `eval()`，我们阅读注释、分析他的作用：
❶输入：cmdline，一行命令作为参数。
❷处理：
		①判断，是不是内置命令(==quit==、jobs、bg、fg)，如果是，直接执行。(这不就刚才完成了一个quit吗，我们原来是要在这里调用builtin_cmd)
		②如果不是内置命令(Otherwise)，`fork()`产生一个子进程，运行job。
		③如果job是前台的，等待(哦，似乎有一个`waitfg()`函数来着？)
❸输出：无
懂了，我们要初步实现的就是eval函数处理过程的逻辑！
### 思考：
①如何判断，命令是不是内置命令？`builtin_cmd()`已经做到了，如果不是，这个函数会返回0，如果命令内置命令的话，它会直接处理完了，返回1，所以这样写：
```C
	if(builtin_cmd(argv)){
		return; //如果是内置命令，builtin_cmd()会直接处理完了，所以我们直接return，跳出这个函数即可。
	}
```
argv哪来的？得提前定义！并借助`parseline()`函数，解析获取！
```C
char *argv[MAXARGS];//数组大小源自于文件开头定义的MAXARGS(max arguments)常数

parseline(cmdline,argv);
```
而又因为parseline的输出告诉我们了这个命令是是前台还是后台，我们需要一个变量来记录，所以还要定义一个变量bg：
```C
int bg;

bg =parseline(cmdline,argv);
```
内置命令搞定了，判定前/后台变量也搞定了
②接下来处理不是内置命令的情况：我们要先`fork()`一个子进程，然后子进程调用`execve()`执行目标命令，替换掉子进程
```C
pid_t pid;  //定义pid变量以接受fork()的返回值

pid = fork();
//子进程
if(pid == 0){
	execve(argv[0],argv,environ);
}
```
③父进程怎么处理？如果是前台进程(即bg = 0)要等待
我们先看看`waitfg()`，《等待前台进程》这个函数让我们完成啥吧？
注释告诉我们：
![[Pasted image 20260802163851.png]]
🌟只要一个进程还是前台进程，我们就要一直等待它结束。
等着简单：我们知道有一个`waitpid()`函数
如何判断一个进程是前台进程啊？？？我们只知道pid啊。
不好说，我们先空着，
？因为trace2只要求我们处理内置命令。

于是，`waitfg()`的框架成型了：
```C
void waitfg(pid_t pid)
{

    return;
}
```
所以父进程的框架也能成型了：
```C
//父进程处理
//前台进程
if(bg == 0){  
	waitfg(pid);
	
}

//后台进程
if(bg == 1){

}
```
完成拼起来，填入`eval()`就是：
![[Pasted image 20260802165948.png]]
来吧，make、make test02和make rtest02，比较结果。发现也是直接过了！输出一模一样，在最后输出完之后，成功自动quit了
![[Pasted image 20260802170313.png]]

>trace02的内容其实本没有这么复杂，没有涉及到关于非内置命令的复杂处理。
如fork()、execve()、以及判断前台、后台作业，分别情况处理的部分。
但是我们在分析的过程当中，想到了shell处理的逻辑本来就要按照这个框架分类，所以提前打好了框架，也更便于下一步！

这篇有点长了，我们在[[Shell实验破解-3]]里继续解决trace03到trace16！