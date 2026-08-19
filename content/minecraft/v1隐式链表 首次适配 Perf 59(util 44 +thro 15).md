```C
/*

 * mm.c v1:隐式链表 首次适配

 */

#include <stdio.h>

#include <stdlib.h>

#include <assert.h>

#include <unistd.h>

#include <string.h>

  

#include "mm.h"

#include "memlib.h"

  

/*********************************************************

 * NOTE TO STUDENTS: Before you do anything else, please

 * provide your team information in the following struct.

 ********************************************************/

team_t team = {

    /* Team name */

    "TJU-JK-No.1",

    /* First member's full name */

    "Yijian Liu",

    /* First member's email address */

    "3025244167@tju.edu.cn",

    /* Second member's full name (leave blank if none) */

    "",

    /* Second member's email address (leave blank if none) */

    ""

};

  

#define MAX(a,b) (((a) > (b)) ?  (a):(b))

  
  

/*新的对齐，需要我们加上头部和脚部，所以我们直接舍弃这个旧的对齐部分*/

/* single word (4) or double word (8) alignment */

//#define ALIGNMENT DSIZE

/* rounds up to the nearest multiple of ALIGNMENT */

//#define ALIGN(size) (((size) + (ALIGNMENT-1)) & ~(ALIGNMENT-1))

  
  
  

/*由于HEADER、FOOTER存储内存块的大小size，不会超过4GB，所以4个字节就够了，而size_t在Linux中是8字节，浪费了，

我们直接删掉SIZE_T_SIZE这个宏的定义，换成书上的宏的WSIZE、DSIZE的定义*/

//#define SIZE_T_SIZE (ALIGN(sizeof(size_t)))

  

#define WSIZE 4   //header的大小  =  footer的大小 = word(4个字节)

#define DSIZE 8   //double word size (8个字节)

#define CHUNKSIZE ( 1 << 12 ) //每一次mem_sbrk()的大小设定为4096,每次扩展4096字节(一个内存页)的堆的大小

  
  

#define PACK(size,alloc) ((size)|(alloc))//打包size大小和分配位alloc

  
  

/*读取、写入一个位于p指针所对应的地址的word(4个字节)的内容*/

#define GET(p) (*(unsigned int * )(p))

#define PUT(p,val) (*(unsigned int * )(p) = (val))

  

/*从header和footer的指针中读取size和alloc的信息*/

#define GET_SIZE(p) (GET(p) & ~0x7)

#define GET_ALLOC(p) (GET(p) & 0x1)

  

/*根据块的载荷所对应的指针地址，来得出块header和footer所对应的指针地址*/

#define HDRP(bp) ((char *)(bp) - WSIZE)

#define FTRP(bp) ((char *)(bp) + GET_SIZE(HDRP(bp))  - DSIZE )

  

/*根据当前块的指针地址，计算得出前一个块和后一个块分别的指针地址，以便于我们合并*/

#define PREV_BLKP(bp) ((char *)(bp) - GET_SIZE(((char *)(bp) - DSIZE)))

#define NEXT_BLKP(bp) ((char *)(bp) + GET_SIZE(HDRP(bp)))

  
  

static char *heap_listp;    /* 永远指向序言块的0载荷位置 */

  
  

/*辅助我们完成函数的一些小函数*/

static void *extend_heap(size_t words);//扩展heap

static void *coalesce(void *bp);//合并空闲块

static void *find_fit(size_t asize);//找到一个合适的空闲块

static void  place(void *bp, size_t asize);//分配合适大小的空闲块

  

/*

*1️⃣extend_heap(),扩展堆的空间，来存放用户使用的空闲块

*/

static void *extend_heap(size_t words){

  

    char *bp;//新增的空闲块的载荷指针

    size_t size;//要sbrk的块的大小

  

    /*size 一定要凑成偶数个字，才能实现对齐，让整体大小成为8的倍数*/

    size = (words % 2) ? (words+1) * WSIZE :  words * WSIZE;

  

    if((bp = mem_sbrk(size)) == (void *)-1){

        return NULL;

    }

  

    PUT(HDRP(bp),PACK(size,0)); //把旧结尾快的位置覆盖，变成新的空闲块的头部

    PUT(FTRP(bp),PACK(size,0));//增加空闲块的脚部

    PUT(HDRP(NEXT_BLKP(bp)),PACK(0,1));//新的结尾块

  

    return coalesce(bp); //新增空闲块之后，如果前面也有空闲块，进行一次合并

  

}

  
  

/*

*

*/

static void *coalesce(void *bp){

    //得知两边的占用情况

    size_t prev_alloc = GET_ALLOC(FTRP(PREV_BLKP(bp)));//前一个块的占用情况

    size_t next_alloc = GET_ALLOC(HDRP(NEXT_BLKP(bp)));//后一个块的占用情况

    //得知自己的块的大小，便于往后跳 bp + size

    size_t size  =GET_SIZE(HDRP(bp));

  

    //1️⃣两侧都占用，不合并，直接返回bp

    if(prev_alloc && next_alloc){

        return bp;

    }

  

    //2️⃣前占用，后空闲，合并后侧块，改写HDRP、FTRP

    if(prev_alloc && !next_alloc){

  

        size += GET_SIZE(HDRP(NEXT_BLKP(bp)));

  

        PUT(HDRP(bp) , PACK(size,0));

        PUT(FTRP(bp) , PACK(size,0));

    }

  

    //3️⃣前空闲，后占用，让前侧块合并后侧快，改写HDRP、FTRP

    if(!prev_alloc && next_alloc){

  

        size += GET_SIZE(HDRP(PREV_BLKP(bp)));

  

        PUT(HDRP(PREV_BLKP(bp)),PACK(size,0)); //新的HDRP变成了前一个块的HDRP

        PUT(FTRP(bp),PACK(size,0)); //新的FTRP仍然是现在块的FTRP，里面内容size要改

        bp = PREV_BLKP(bp);

    }

  

    //4️⃣两侧都空

    if(!prev_alloc && !next_alloc){

        size  = size + GET_SIZE(FTRP(PREV_BLKP(bp))) + GET_SIZE(HDRP(NEXT_BLKP(bp)));

        PUT(HDRP(PREV_BLKP(bp)),PACK(size , 0)); // 头部变成原来前一块的头部

        PUT(FTRP(NEXT_BLKP(bp)),PACK(size , 0)); // 尾部变成原来后一块的尾部

  

        bp = PREV_BLKP(bp);

    }  

  

    return bp;

  
  
  

}

  
  
  
  
  
  

/*

 * mm_init - initialize the malloc package.

 */

int mm_init(void)

{

    //初始化heap的组织方式：包括填充字、序言块、结尾块

    if((heap_listp = mem_sbrk(4 * WSIZE)) ==(void *)-1)return -1;

  

    PUT(heap_listp,0); /*填充字*/

    PUT(heap_listp + (1*WSIZE) , PACK(DSIZE,1));/*序言头*/

    PUT(heap_listp + (2*WSIZE) , PACK(DSIZE,1));/*序言脚*/

    PUT(heap_listp + (3*WSIZE) , PACK(0,1));/*结尾快*/

    heap_listp += 2*WSIZE;//指向序言块的0载荷位置

  

    if(extend_heap(CHUNKSIZE/WSIZE) == NULL){

        return -1;

    }

  
  
  

    return 0;

}

  
  
  

 /*3️⃣find_fit()：

 *      输出：合适大小的块的载荷开头的地址指针

 */

 static void *find_fit(size_t asize){

    void *bp;//定义输出

    for(bp = heap_listp ; GET_SIZE(HDRP(bp)) > 0; bp = NEXT_BLKP(bp) ){

        if(!GET_ALLOC(HDRP(bp)) &&  GET_SIZE(HDRP(bp)) >= asize ){

            return bp; //逐个寻找，如果找到了合适的块，就返回这个块的地址

        }

    }

    return NULL; /*没有找到合适的块，需要extend_heap*/

 }

  
  

/*4️⃣place()：

*       从堆中切割出相应大小的内存，分配给用户

*/

static void  place(void *bp, size_t asize){

    size_t csize = GET_SIZE(HDRP(bp)); //当前块的大小

  

    if(csize - asize >= (2*DSIZE)){//剩余的足够大，超过了最小的16字节，还能被利用，切下来

        PUT(HDRP(bp),PACK(asize,1));

        PUT(FTRP(bp),PACK(asize,1));

        bp =NEXT_BLKP(bp);

        //切下来c-a大小的一片内存区域，

        PUT(HDRP(bp),PACK(csize - asize, 0));//切下来的头部

        PUT(FTRP(bp),PACK(csize - asize, 0));//切下来的脚部

    }

    else{

        PUT(HDRP(bp),PACK(csize,1));

        PUT(FTRP(bp),PACK(csize,1));

    }

  

  

}

  
  
  
  
  
  

 /*

 * mm_malloc - Allocate a block by incrementing the brk pointer.

 *     Always allocate a block whose size is a multiple of the alignment.

 *     1️⃣find_fit()为size大小的内存找到一块合适的内存

 *     2️⃣place()切出相应大小的内存，分配给它

 * ❗️如果超出了当前的堆的内存，需要extended heap

 * 返回值：

 * 分配到那块内存的地址的指针

 */

  

void *mm_malloc(size_t size)

{

    //int newsize = ALIGN(size + DSIZE);

  

    size_t newsize;//需要的size

    size_t extendsize;//如果堆空间不够要扩展的大小

    char * bp;

  
  

    if(size == 0)return NULL;

    //块最小最小得是DSIZE，因为要包括头部和脚步

    if(size <= DSIZE){

        newsize = 2 * DSIZE;

    }else{

        newsize = ((size + DSIZE + (DSIZE-1))/DSIZE)*DSIZE;

    }

  

    //接下来，在空闲的链表中找，看是否有

  

    //如果有，那就直接分配，返回

    if((bp = find_fit(newsize)) != NULL){

        place(bp,newsize);

        return bp;

    }

  

    //如果没有，那就扩展堆空间，分配，返回

    extendsize = MAX(newsize, CHUNKSIZE);

    if((bp = extend_heap(extendsize/WSIZE)) == NULL){

        return NULL;

    }

    place(bp,newsize);

    return bp;

}

  
  
  
  
  
  
  
  
  
  
  
  
  
  

/*

 * mm_free - Freeing a block:

 *1️⃣将block的头部、脚步的占用标记位alloc改写成0，释放这个块

 *2️⃣合并释放之后可能的两侧的空闲块

 */

void mm_free(void *ptr)

{

    size_t size = GET_SIZE(HDRP(ptr));

  

    PUT(HDRP(ptr) , PACK(size,0)) ;//将头部标记为空闲

    PUT(FTRP(ptr) , PACK(size,0)) ;//将脚部标记为空闲

  

    coalesce(ptr); //合并可能的空闲块

  

}

  
  
  
  
  
  
  

/*

 * mm_realloc - Implemented simply in terms of mm_malloc and mm_free

 */

void *mm_realloc(void *ptr, size_t size)

{

    void *oldptr = ptr;

    void *newptr;

    size_t copySize;

  

    if (ptr == NULL)                    /* 边界条件 1 */

        return mm_malloc(size);

  

    if (size == 0) {                    /* 边界条件 2 */

        mm_free(ptr);

        return NULL;

    }

  
  

    newptr = mm_malloc(size);

    if (newptr == NULL)

      return NULL;

  

    copySize = GET_SIZE(HDRP(oldptr)) - DSIZE;

  

    if (size < copySize)

      copySize = size;

  

    memcpy(newptr, oldptr, copySize);

    mm_free(oldptr);

    return newptr;

}
```