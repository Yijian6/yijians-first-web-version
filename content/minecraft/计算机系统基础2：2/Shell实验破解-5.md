---
日期: 2026-08-04
网址: shell-over-5
蓝图: Shell实验破解-5
---
# Shell实验破解-5
话不多说，直接进trace09，我们争取这篇文章干完后面所有的！
## Trace09
![[Pasted image 20260804104337.png|287]]![[Pasted image 20260804105846.png|366]]
要求：`#处理bg内置命令`，这个%是啥意思来着？搜索！![[Pasted image 20260804104918.png]]
在规范里看到这一句话，也就是说，我们要识别命令的第二个参数`argv[1]`，判定有没有%，从而判定，到底是由PID对应作业，还是JID，有%的是JID，没有的是PID。

同样回顾README，bg内置命令让我们完成这样一件事情：![[Pasted image 20260804104641.png]]
❶先识别——`builtin_cmd()来完成`
❷将停止的后台作业的状态改变，从ST改成BG——`do_fgbg()`函数完成
目标明确，直接行动。
❶识别：模仿quit、jobs
![[Pasted image 20260804105339.png|445]]
❷构思如何用bg把后台暂停作业改变成运行：
	1、给子进程组发送SIGCONT，让他们继续运行
	2、修改作业列表中的状态，`job->state从ST变成BG`
	3、根据make rtest09，还要输出改变后的作业状态！！
思路清晰，代码就清晰：
	1、定义作业job
	2、if else确认究竟是由JID确定job还是PID，确认job
	3、内置命令修改对应参数，并打印情况！![[Pasted image 20260804111935.png]]
make、test！通过！
![[Pasted image 20260804112125.png|333]]![[Pasted image 20260804105846.png|341]]
## Trace10
![[Pasted image 20260804112208.png|321]]
照猫画虎的前台内置命令！
在刚刚bg这段代码下面直接补充
![[Pasted image 20260804112448.png]]
补充完直接make测试：
![[Pasted image 20260804113126.png|305]]![[Pasted image 20260804112700.png|311]]
一模一样吧？
## Trace11
![[Pasted image 20260804113230.png]]
要求：`#验证能把SIGINT发送到前台进程整组`，这一条我们在之前`setpgid(0,0)`的时候，不就是做的这件事吗？OK啊？直接测试！
输出很长，是ps程序(process status)进程状态查看程序造成的。我们让Claude帮我们比对：
![[Pasted image 20260804113824.png]]
## Trace12
![[Pasted image 20260804113914.png]]
看到要求，相信你一眼也能知道，这个不用测也过了！
## Trace13
![[Pasted image 20260804114018.png|401]]
要求：`#重新启动进程组的每一个进程`，意思是说，让我们验证一个进程被暂停之后，fg能启动整个作业的进程组。
我们的代码中有kill(-pid,SIGCONT)，实际上就是发送了整组的信号，所以，完成！
make、测试、通过！
## Trace14
内容很长，我复制过来逐行解释，要我们处理一些错误情况
```bash
yijian@Jue:~/re-lab/shelllab$ cat trace14.txt
#
# trace14.txt - Simple error handling
#

1️⃣故意启动了一个没有的程序，我们直接execve()会报错，要判断
/bin/echo tsh> ./bogus  
./bogus 


/bin/echo -e tsh> ./myspin 4 \046
./myspin 4 &

2️⃣fg、bg命令，没加参数！
/bin/echo tsh> fg
fg

/bin/echo tsh> bg
bg
3️⃣参数错误，没有写成%数字，或数字
/bin/echo tsh> fg a
fg a

/bin/echo tsh> bg a
bg a

4️⃣PID、JID不存在！
/bin/echo tsh> fg 9999999
fg 9999999

/bin/echo tsh> bg 9999999
bg 9999999

/bin/echo tsh> fg %2
fg %2

/bin/echo tsh> fg %1
fg %1

SLEEP 2
TSTP

/bin/echo tsh> bg %2
bg %2

/bin/echo tsh> bg %1
bg %1

/bin/echo tsh> jobs
jobs
```
再看一下应对这些错误情况标准的输出make rtest14
![[Pasted image 20260804115047.png|510]]
### 逐一处理！
### 1️⃣启动错误程序，怎么办？我们利用`execve()`执行失败返回`-1`这一点，改动：
![[Pasted image 20260804115401.png|287]]![[Pasted image 20260804115552.png|259]]
### 2️⃣3️⃣4️⃣fg、bg命令，参数问题讨论
	可分如下类讨论：
		1、没加参数(argv[1] == NULL)
		2、加了参数，参数不是`%数字`或`数字`()
		3、参数是`%数字`或`数字`，
			❶但不是正确的JID、PID
			❷参数正确，可以找到对应PID、JID的job
	全都是do_bgfg()函数获取job时候的处理。我们用
		1、if 
		2、else if
		3、else 
	来分别处理三种情况

![[Pasted image 20260804120843.png]]
OK啊，直接测试。
![[Pasted image 20260804121059.png|298]]![[Pasted image 20260804121059.png|292]]
逐行比对，通过！
## Trace15、16
![[Pasted image 20260804121345.png|596]]
![[Pasted image 20260804121336.png]]
看名字，你会发现，最后的这两，是综合类的测试。通常，前面的过了，这两也都能过。我们直接简单make test、make rtest ，比对。发现，果然如此。
# 祝贺你，勇士！完成了考验！
Shell实验，到此结束。
