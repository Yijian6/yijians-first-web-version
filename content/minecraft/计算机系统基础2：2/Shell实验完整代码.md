---
日期: 2026-08-06
网址: shell-answer
蓝图: Shell实验完整代码
---
# Shell实验完整代码
>一千个读者有一千个哈姆雷特。以下的代码只是我的一种想法。仅供参考

`tsh.c`:
```C
/*

 * tsh - A tiny shell program with job control

 *

 * <Liu Yi Jian 666>

 */

#include <stdio.h>

#include <stdlib.h>

#include <unistd.h>

#include <string.h>

#include <ctype.h>

#include <signal.h>

#include <sys/types.h>

#include <sys/wait.h>

#include <errno.h>

  

/* Misc manifest constants */

#define MAXLINE    1024   /* max line size */

#define MAXARGS     128   /* max args on a command line */

#define MAXJOBS      16   /* max jobs at any point in time */

#define MAXJID    1<<16   /* max job ID */

  

/* Job states */

#define UNDEF 0 /* undefined */

#define FG 1    /* running in foreground */

#define BG 2    /* running in background */

#define ST 3    /* stopped */

  

/*

 * Jobs states: FG (foreground), BG (background), ST (stopped)

 * Job state transitions and enabling actions:

 *     FG -> ST  : ctrl-z

 *     ST -> FG  : fg command

 *     ST -> BG  : bg command

 *     BG -> FG  : fg command

 * At most 1 job can be in the FG state.

 */

  

/* Global variables */

extern char **environ;      /* defined in libc */

char prompt[] = "tsh> ";    /* command line prompt (DO NOT CHANGE) */

int verbose = 0;            /* if true, print additional output */

int nextjid = 1;            /* next job ID to allocate */

char sbuf[MAXLINE];         /* for composing sprintf messages */

  

struct job_t {              /* The job struct */

    pid_t pid;              /* job PID */

    int jid;                /* job ID [1, 2, ...] */

    int state;              /* UNDEF, BG, FG, or ST */

    char cmdline[MAXLINE];  /* command line */

};

struct job_t jobs[MAXJOBS]; /* The job list */

/* End global variables */

  
  
  

/* Function prototypes */

  

/* Here are the functions that you will implement */

void eval(char *cmdline);

int builtin_cmd(char **argv);

void do_bgfg(char **argv);

void waitfg(pid_t pid);

  

void sigchld_handler(int sig);

void sigtstp_handler(int sig);

void sigint_handler(int sig);

  

/* Here are helper routines that we've provided for you */

int parseline(const char *cmdline, char **argv);

void sigquit_handler(int sig);

  

void clearjob(struct job_t *job);

void initjobs(struct job_t *jobs);

int maxjid(struct job_t *jobs);

int addjob(struct job_t *jobs, pid_t pid, int state, char *cmdline);

int deletejob(struct job_t *jobs, pid_t pid);

pid_t fgpid(struct job_t *jobs);

struct job_t *getjobpid(struct job_t *jobs, pid_t pid);

struct job_t *getjobjid(struct job_t *jobs, int jid);

int pid2jid(pid_t pid);

void listjobs(struct job_t *jobs);

  

void usage(void);

void unix_error(char *msg);

void app_error(char *msg);

typedef void handler_t(int);

handler_t *Signal(int signum, handler_t *handler);

  

/*

 * main - The shell's main routine

 */

int main(int argc, char **argv)

{

    char c;

    char cmdline[MAXLINE];

    int emit_prompt = 1; /* emit prompt (default) */

  

    /* Redirect stderr to stdout (so that driver will get all output

     * on the pipe connected to stdout) */

    dup2(1, 2);

  

    /* Parse the command line */

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

  

    /* Install the signal handlers */

  

    /* These are the ones you will need to implement */

    Signal(SIGINT,  sigint_handler);   /* ctrl-c */

    Signal(SIGTSTP, sigtstp_handler);  /* ctrl-z */

    Signal(SIGCHLD, sigchld_handler);  /* Terminated or stopped child */

  

    /* This one provides a clean way to kill the shell */

    Signal(SIGQUIT, sigquit_handler);

  

    /* Initialize the job list */

    initjobs(jobs);

  

    /* Execute the shell's read/eval loop */

    while (1) {

  

    /* Read command line */

    if (emit_prompt) {

        printf("%s", prompt);

        fflush(stdout);

    }

    if ((fgets(cmdline, MAXLINE, stdin) == NULL) && ferror(stdin))

        app_error("fgets error");

    if (feof(stdin)) { /* End of file (ctrl-d) */

        fflush(stdout);

        exit(0);

    }

  

    /* Evaluate the command line */

    eval(cmdline);

    fflush(stdout);

    fflush(stdout);

    }

  

    exit(0); /* control never reaches here */

}

/*

 * eval - Evaluate the command line that the user has just typed in

 *

 * If the user has requested a built-in command (quit, jobs, bg or fg)

 * then execute it immediately. Otherwise, fork a child process and

 * run the job in the context of the child. If the job is running in

 * the foreground, wait for it to terminate and then return.  Note:

 * each child process must have a unique process group ID so that our

 * background children don't receive SIGINT (SIGTSTP) from the kernel

 * when we type ctrl-c (ctrl-z) at the keyboard.  

*/

void eval(char *cmdline)

{

    char *argv[MAXARGS];//定义argv[]

    int bg;  //后台、前台标志

    pid_t pid; //进程id

  

    //信号阻塞定义、做好准备

    sigset_t set, oldset;             // 声明两个信号集合

    sigemptyset(&set);              // 清空 mask

    sigaddset(&set, SIGCHLD);       // 把 SIGCHLD 加进去

  
  
  

    bg = parseline(cmdline,argv);

  

    if(argv[0] == NULL){

        return;

    }     //注意一点，因为trace里面有可能有空行，

  

    if(builtin_cmd(argv)){ //判定、并且处理内置命令

        return;//处理完返回

    }

    sigprocmask(SIG_BLOCK, &set, &oldset);   // ① 子进程发生前阻塞信号

    pid = fork();//创建子进程

  

    //子进程：走非内置命令，被替代

    if(pid == 0){    

        setpgid(0,0);

        sigprocmask(SIG_SETMASK, &oldset, NULL); // ② 子进程不阻塞sigprocmask(SIG_SETMASK, &oldset, NULL); // ② 子进程不阻塞

        if(execve(argv[0],argv,environ)<0){

            printf("%s: Command not found\n",argv[0]);

            exit(0);//如果失败，打印错误信息，退出子进程

        };

    }

    //父进程：

  

    //父进程前台作业的处理

    if(bg == 0){

        addjob(jobs,pid,FG,cmdline);

        sigprocmask(SIG_SETMASK, &oldset, NULL);   // ④ 在addjob之后父进程解除阻塞

        waitfg(pid);

    }

  

    //父进程后台作业的处理

    if(bg == 1){

        addjob(jobs,pid,BG,cmdline);//之前已经初始化了jobs清单，可以直接用,BG表示后台作业

        printf("[%d] (%d) %s",pid2jid(pid),pid,cmdline);//输出到屏幕上

        sigprocmask(SIG_SETMASK, &oldset, NULL);   // ④ 在addjob之后父进程解除阻塞

    }

    return;

}

  

/*

 * parseline - Parse the command line and build the argv array.

 *

 * Characters enclosed in single quotes are treated as a single

 * argument.  Return true if the user has requested a BG job, false if

 * the user has requested a FG job.  

 */

int parseline(const char *cmdline, char **argv)

{

    static char array[MAXLINE]; /* holds local copy of command line */

    char *buf = array;          /* ptr that traverses command line */

    char *delim;                /* points to first space delimiter */

    int argc;                   /* number of args */

    int bg;                     /* background job? */

  

    strcpy(buf, cmdline);

    buf[strlen(buf)-1] = ' ';  /* replace trailing '\n' with space */

    while (*buf && (*buf == ' ')) /* ignore leading spaces */

    buf++;

  

    /* Build the argv list */

    argc = 0;

    if (*buf == '\'') {

    buf++;

    delim = strchr(buf, '\'');

    }

    else {

    delim = strchr(buf, ' ');

    }

  

    while (delim) {

    argv[argc++] = buf;

    *delim = '\0';

    buf = delim + 1;

    while (*buf && (*buf == ' ')) /* ignore spaces */

           buf++;

  

    if (*buf == '\'') {

        buf++;

        delim = strchr(buf, '\'');

    }

    else {

        delim = strchr(buf, ' ');

    }

    }

    argv[argc] = NULL;

    if (argc == 0)  /* ignore blank line */

    return 1;

  

    /* should the job run in the background? */

    if ((bg = (*argv[argc-1] == '&')) != 0) {

    argv[--argc] = NULL;

    }

    return bg;

}

  

/*

 * builtin_cmd - If the user has typed a built-in command then execute

 *    it immediately.  

 */

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

    /*fgbg内置命令，识别，并且处理*/

    if(strcmp(argv[0],"fg") == 0||(strcmp(argv[0],"bg"))== 0){

        do_bgfg(argv);

        return 1;

    }

  

    return 0;     /* not a builtin command */

}

  

/*

 * do_bgfg - Execute the builtin bg and fg commands

 */

void do_bgfg(char **argv)

{

    struct job_t *job; //定义job，然后，我们需要从JID或者PID中获取出来job，不管哪一个都有现成的函数

  

    //根据第二个参数的第一个字符是否是%来判定到底是JID还是PID，选择getjobjid()还是getjobpid()

     //1、参数为空的情况

    if(argv[1] == NULL){

        printf("%s command requires PID or %%jobid argument\n",argv[0]);

        return;

    }

  

    //2、参数不为空，但参数不是%开头，并且不是数字的情况

    else if(argv[1][0] != '%' && !isdigit(argv[1][0])){

        printf("%s: argument must be a PID or %%jobid\n",argv[0]);

        return;

  

    }

    //3、参数是%开头、或者是数字的情况

    else{

        if(argv[1][0] == '%'){

            int jid = atoi(&argv[1][1]);

            job = getjobjid(jobs,jid);

                //如果没有这个job，getjobjid会返回NULL，利用这一点，我们让其返回NULL的时候，表示没有找到这个job

                if(job == NULL){

                    printf("%s: No such job\n",argv[1]);

                    return;

                }

            }

            else {

                pid_t pid =atoi(argv[1]);

                job = getjobpid(jobs,pid);

                //同理

                if(job == NULL){

                    printf("(%s): No such process\n",argv[1]);

                    return;

                }

  

            }

  
  

        }

  

    //bg内置命令处理

    if(strcmp(argv[0],"bg") == 0){

        kill(-job->pid,SIGCONT);

        job->state = BG;

        printf("[%d] (%d) %s", job->jid, job->pid, job->cmdline);

    }

    //fg

    if(strcmp(argv[0],"fg") == 0){

        kill(-job->pid,SIGCONT);

        job->state = FG;

        waitfg(job->pid);

    }

    return;

}

  

/*

 * waitfg - Block until process pid is no longer the foreground process

 */

void waitfg(pid_t pid)

{

    while (fgpid(jobs) == pid){

        sleep(1);

    }

    return;

}

  

/*****************

 * Signal handlers

 *****************/

  

/*

 * sigchld_handler - The kernel sends a SIGCHLD to the shell whenever

 *     a child job terminates (becomes a zombie), or stops because it

 *     received a SIGSTOP or SIGTSTP signal. The handler reaps all

 *     available zombie children, but doesn't wait for any other

 *     currently running children to terminate.  

 */

void sigchld_handler(int sig)

{

    pid_t pid; //定义pid，用来接受waitpid的返回值

    int status;

    //不等待，立刻回收所有被终止的进程/这里补上被暂停的进程也要

    while ((pid = waitpid(-1,&status,WNOHANG | WUNTRACED))>0){ //WNOHANG和WUNTRACED搭配使用，有暂停、终止的就回收，没有就返回0

  

        //如果是正常退出的，直接删除，依旧没毛病

        if(WIFEXITED(status)){

            deletejob(jobs,pid);

        }  

  

        //如果是被信号终止的，获取终止它的哪个信号信息，打印情况，再删除

        if(WIFSIGNALED(status)){

            printf("Job [%d] (%d) terminated by signal %d\n",pid2jid(pid),pid,WTERMSIG(status));

            fflush(stdout);//刷新缓冲区，让输出直接打印。

            deletejob(jobs,pid);

        }

  

        //如果是被信号暂停的，获取暂停它的信号信息，打印情况，更改job的状态，不删除

       if(WIFSTOPPED(status)){

            printf("Job [%d] (%d) stopped by signal %d\n",pid2jid(pid),pid,WSTOPSIG(status));

            fflush(stdout);

  

            struct job_t *job =getjobpid(jobs,pid); //根据工具库，getjob()函数可以帮助我们使用pid直接找到对应的哪个job

            if(job != NULL){

                job->state = ST;  //结构体使用->来访问并改变state。

            }

        }

    }

  

    return;

}

  

/*

 * sigint_handler - The kernel sends a SIGINT to the shell whenver the

 *    user types ctrl-c at the keyboard.  Catch it and send it along

 *    to the foreground job.  

 */

void sigint_handler(int sig)

{

    pid_t pid;// 先定义pid，为了后续使用

    pid = fgpid(jobs); //获取现在前台的作业(因为我们要终止它)

  

    if(pid != 0){

        kill(-pid,sig);

    }

    return;

}

  

/*

 * sigtstp_handler - The kernel sends a SIGTSTP to the shell whenever

 *     the user types ctrl-z at the keyboard. Catch it and suspend the

 *     foreground job by sending it a SIGTSTP.  

 */

void sigtstp_handler(int sig)

{

    pid_t pid;

    pid = fgpid(jobs);

  

    if(pid != 0){

        kill(-pid,sig);

    }

    return;

}

  
  

/*********************

 * End signal handlers

 *********************/

  

/***********************************************

 * Helper routines that manipulate the job list

 **********************************************/

  

/* clearjob - Clear the entries in a job struct */

void clearjob(struct job_t *job) {

    job->pid = 0;

    job->jid = 0;

    job->state = UNDEF;

    job->cmdline[0] = '\0';

}

  

/* initjobs - Initialize the job list */

void initjobs(struct job_t *jobs) {

    int i;

  

    for (i = 0; i < MAXJOBS; i++)

    clearjob(&jobs[i]);

}

  

/* maxjid - Returns largest allocated job ID */

int maxjid(struct job_t *jobs)

{

    int i, max=0;

  

    for (i = 0; i < MAXJOBS; i++)

    if (jobs[i].jid > max)

        max = jobs[i].jid;

    return max;

}

  

/* addjob - Add a job to the job list */

int addjob(struct job_t *jobs, pid_t pid, int state, char *cmdline)

{

    int i;

    if (pid < 1)

    return 0;

  

    for (i = 0; i < MAXJOBS; i++) {

    if (jobs[i].pid == 0) {

        jobs[i].pid = pid;

        jobs[i].state = state;

        jobs[i].jid = nextjid++;

        if (nextjid > MAXJOBS)

        nextjid = 1;

        strcpy(jobs[i].cmdline, cmdline);

        if(verbose){

            printf("Added job [%d] %d %s\n", jobs[i].jid, jobs[i].pid, jobs[i].cmdline);

            }

            return 1;

    }

    }

    printf("Tried to create too many jobs\n");

    return 0;

}

  

/* deletejob - Delete a job whose PID=pid from the job list */

int deletejob(struct job_t *jobs, pid_t pid)

{

    int i;

  

    if (pid < 1)

    return 0;

  

    for (i = 0; i < MAXJOBS; i++) {

    if (jobs[i].pid == pid) {

        clearjob(&jobs[i]);

        nextjid = maxjid(jobs)+1;

        return 1;

    }

    }

    return 0;

}

  

/* fgpid - Return PID of current foreground job, 0 if no such job */

pid_t fgpid(struct job_t *jobs) {

    int i;

  

    for (i = 0; i < MAXJOBS; i++)

    if (jobs[i].state == FG)

        return jobs[i].pid;

    return 0;

}

  

/* getjobpid  - Find a job (by PID) on the job list */

struct job_t *getjobpid(struct job_t *jobs, pid_t pid) {

    int i;

  

    if (pid < 1)

    return NULL;

    for (i = 0; i < MAXJOBS; i++)

    if (jobs[i].pid == pid)

        return &jobs[i];

    return NULL;

}

  

/* getjobjid  - Find a job (by JID) on the job list */

struct job_t *getjobjid(struct job_t *jobs, int jid)

{

    int i;

  

    if (jid < 1)

    return NULL;

    for (i = 0; i < MAXJOBS; i++)

    if (jobs[i].jid == jid)

        return &jobs[i];

    return NULL;

}

  

/* pid2jid - Map process ID to job ID */

int pid2jid(pid_t pid)

{

    int i;

  

    if (pid < 1)

    return 0;

    for (i = 0; i < MAXJOBS; i++)

    if (jobs[i].pid == pid) {

            return jobs[i].jid;

        }

    return 0;

}

  

/* listjobs - Print the job list */

void listjobs(struct job_t *jobs)

{

    int i;

    for (i = 0; i < MAXJOBS; i++) {

    if (jobs[i].pid != 0) {

        printf("[%d] (%d) ", jobs[i].jid, jobs[i].pid);

        switch (jobs[i].state) {

        case BG:

            printf("Running ");

            break;

        case FG:

            printf("Foreground ");

            break;

        case ST:

            printf("Stopped ");

            break;

        default:

            printf("listjobs: Internal error: job[%d].state=%d ",

               i, jobs[i].state);

        }

        printf("%s", jobs[i].cmdline);

    }

    }

}

/******************************

 * end job list helper routines

 ******************************/

  
  

/***********************

 * Other helper routines

 ***********************/

  

/*

 * usage - print a help message

 */

void usage(void)

{

    printf("Usage: shell [-hvp]\n");

    printf("   -h   print this message\n");

    printf("   -v   print additional diagnostic information\n");

    printf("   -p   do not emit a command prompt\n");

    exit(1);

}

  

/*

 * unix_error - unix-style error routine

 */

void unix_error(char *msg)

{

    fprintf(stdout, "%s: %s\n", msg, strerror(errno));

    exit(1);

}

  

/*

 * app_error - application-style error routine

 */

void app_error(char *msg)

{

    fprintf(stdout, "%s\n", msg);

    exit(1);

}

  

/*

 * Signal - wrapper for the sigaction function

 */

handler_t *Signal(int signum, handler_t *handler)

{

    struct sigaction action, old_action;

  

    action.sa_handler = handler;  

    sigemptyset(&action.sa_mask); /* block sigs of type being handled */

    action.sa_flags = SA_RESTART; /* restart syscalls if possible */

  

    if (sigaction(signum, &action, &old_action) < 0)

    unix_error("Signal error");

    return (old_action.sa_handler);

}

  

/*

 * sigquit_handler - The driver program can gracefully terminate the

 *    child shell by sending it a SIGQUIT signal.

 */

void sigquit_handler(int sig)

{

    printf("Terminating after receipt of SIGQUIT signal\n");

    exit(1);

}
```