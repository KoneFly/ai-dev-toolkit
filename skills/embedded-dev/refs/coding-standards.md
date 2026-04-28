# 嵌入式代码规范参考

> 本文件由主协议按需加载。EXECUTE 阶段编写代码时读取此文件。

---

## 模块化编程规则

**核心原则**：每个功能/外设模块独立为 `.c` + `.h` 文件对，`main.c` 保持整洁简单。

**文件组织结构**：
```
项目目录/
├── main.c              // 仅包含初始化调用和主循环
├── led.c / led.h       // LED 控制模块
├── uart.c / uart.h     // 串口通信模块
├── timer.c / timer.h   // 定时器模块
├── adc.c / adc.h       // ADC 采集模块
└── ...
```

**main.c 规范**：
- 仅包含：头文件引用、全局初始化调用、主循环逻辑
- 禁止在 `main.c` 中直接编写外设驱动代码或复杂业务逻辑
- 初始化统一通过调用各模块的 `XXX_Init()` 函数完成

**模块文件规范**：
- `.h` 文件：包含头文件保护宏、函数声明、宏定义、类型定义
- `.c` 文件：包含具体实现、模块内部静态变量
- 模块间通过头文件暴露的接口通信，禁止跨模块直接访问内部变量
- 中断服务函数（ISR）放在对应模块的 `.c` 文件中，而非 `main.c`

**命名规范**：
- 文件名使用小写，与模块功能对应（如 `gpio.c`、`spi.c`）
- 函数名以模块名为前缀（如 `LED_Init()`、`UART_SendByte()`）
- 头文件保护宏格式：`MODULE_H`（如 `LED_H`、`UART_H`），**禁止**以双下划线 `__` 开头（C 标准保留标识符）

**main.c 示例**：
```c
#include "led.h"
#include "uart.h"
#include "timer.h"

int main(void)
{
    SystemInit();
    LED_Init();
    UART_Init(115200);
    Timer_Init();

    while(1)
    {
        /* 主循环逻辑，调用各模块接口 */
    }
}
```

---

## 代码块格式

```c
/* ... 现有代码 ... */
void Peripheral_IRQHandler(void)
{
/* {{ 修改 }} */
+  /* 检查中断标志 */
+  if(Peripheral_GetITStatus(FLAG) != RESET)
+  {
+    Peripheral_ClearITPendingBit(FLAG);
+    counter++;
+  }
  /* ... 现有代码 ... */
}
```

---

## 禁止行为

- 使用未验证的依赖
- 留下不完整功能
- ISR 中使用阻塞操作
- ISR 中过度使用栈空间
- 关键路径中动态内存分配
- 忽略硬件约束
- 混合不同库的 API 调用

---

## 嵌入式关键关注点

- **中断处理**：正确配置优先级，最小化 ISR 执行时间，避免死锁
- **DMA 操作**：正确配置，处理完成/错误回调，管理缓冲区同步
- **定时器使用**：考虑溢出、预分频器计算、精确定时
- **功耗管理**：睡眠模式、唤醒源、功耗优化
- **时钟配置**：外设时钟设置、PLL 配置、时序要求

### 通用初始化四步法

1. **使能时钟**
2. **定义配置结构体**
3. **配置结构体成员**
4. **初始化外设**

---

## 代码输出格式规范

生成或修改驱动模块时，按以下结构组织输出，确保每次输出格式统一：

```
## 文件：模块名.h

​```c:path/to/module.h
/**
 * @file    module.h
 * @brief   模块功能简述
 */

#ifndef MODULE_H
#define MODULE_H

#ifdef __cplusplus
extern "C" {
#endif

#include "平台头文件.h"

/* 宏定义 */
#define BUFFER_SIZE    256

/* 类型定义 */
typedef struct {
    uint32_t param1;
    uint8_t  param2;
} module_config_t;

/* 函数声明 */
uint8_t Module_Init(module_config_t *config);
int     Module_SendData(uint8_t *data, uint16_t len);

#ifdef __cplusplus
}
#endif

#endif /* MODULE_H */
​```

## 文件：模块名.c

​```c:path/to/module.c
/**
 * @file    module.c
 * @brief   模块功能实现
 */

#include "module.h"

/* 私有宏定义 */
/* 私有变量 */
static volatile uint8_t is_busy = 0;

/* 私有函数声明 */
static void Private_Helper(void);

/* 公共函数实现 */
uint8_t Module_Init(module_config_t *config) { ... }

/* 私有函数实现 */
static void Private_Helper(void) { ... }
​```

## 使用说明

1. 初始化流程和调用顺序
2. 典型使用场景的代码片段
3. 根据实际硬件需要调整的要点（引脚、时钟等）

## 注意事项

- 硬件连接要求和引脚对应关系
- 已知限制或资源约束
- 调试建议（如何验证模块工作正常）
```

---

## 寄存器操作双写注释

使用库函数编写驱动时，在**关键配置位置**用注释附上对应的寄存器操作方式。帮助理解底层原理，也方便需要极致性能时切换到寄存器操作。

**规则**：
- 不要求每行库函数都附注释，只在**关键配置点**（时钟使能、外设初始化、模式选择）处标注
- 注释格式统一为 `/* 寄存器方式: ... */`

**示例**：

```c
/* 使能 USART2 时钟 */
RCC_APB1PeriphClockCmd(RCC_APB1Periph_USART2, ENABLE);
/* 寄存器方式: RCC->APB1ENR |= RCC_APB1ENR_USART2EN; */

/* 配置 PA2 为复用推挽输出 */
GPIO_InitStructure.GPIO_Pin = GPIO_Pin_2;
GPIO_InitStructure.GPIO_Mode = GPIO_Mode_AF_PP;
GPIO_InitStructure.GPIO_Speed = GPIO_Speed_50MHz;
GPIO_Init(GPIOA, &GPIO_InitStructure);
/* 寄存器方式:
 * GPIOA->CRL &= ~(0xF << 8);       // 清除 PA2 配置
 * GPIOA->CRL |=  (0xB << 8);       // PA2: 复用推挽 50MHz (CNF=10, MODE=11)
 */
```

---

## 快速自检清单

每步代码生成完成后，逐项核对以下 6 条。全部通过才提交给用户审查：

- [ ] **命名规范**：函数前缀与模块名一致，变量/宏/结构体命名符合本文件"命名规范"章节
- [ ] **错误处理**：公共函数有参数检查，返回值能区分成功/失败原因
- [ ] **中文注释**：关键步骤有注释说明意图，非显而易见的数值标注了来源
- [ ] **使用示例**：提供了初始化和典型调用的代码片段
- [ ] **寄存器双写**：关键配置点附注了寄存器操作方式
- [ ] **嵌入式安全**：`volatile` 用于 ISR/DMA 共享变量、无裸 `while` 轮询、临界区处理正确
