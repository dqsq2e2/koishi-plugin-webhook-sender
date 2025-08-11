# koishi-plugin-webhook-sender

[![npm](https://img.shields.io/npm/v/koishi-plugin-webhook-sender?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-webhook-sender)

一个用于根据指令发送Webhook请求的Koishi插件，支持自定义指令和接口地址，支持 {QQ} 参数替换。

## 功能特点

- 支持配置多个自定义指令
- 每个指令可以配置独立的webhook地址
- 支持GET和POST请求方法
- 支持自定义请求头和请求体
- 支持 {QQ} 参数替换（自动替换为触发用户的QQ号）
- 参数替换支持嵌套在请求头、请求体、甚至URL中的任意位置
- **可配置成功状态码**，只有指定状态码才认为请求成功
- **响应参数替换**，回复消息可以使用响应数据中的字段
- **可选择性回复**，可独立控制成功/失败时是否回复消息
- **输入参数支持**，用户可在指令中传入自定义参数
- **默认参数支持**，支持"指令 参数"的简化使用方式  
- 支持必需参数和可选参数，可设置默认值
- 支持位置参数和选项参数两种输入方式
- **机器人指定支持**，可配置使用特定平台或ID的机器人执行指令
- **智能请求头过滤**，包含未提供可选参数的请求头项会被自动移除
- 支持嵌套响应数据访问（如 `{user.name}`、`{data.result.message}`）
- 可配置请求超时时间
- 内置帮助指令，查看所有可用指令
- 详细的日志记录，便于调试

## 安装

```bash
npm install koishi-plugin-webhook-sender
# 或者使用yarn
yarn add koishi-plugin-webhook-sender
```

## 配置

插件支持以下配置项：

```typescript
{
  "webhooks": [
    {
      "command": "test-api",              // 指令名称（不需要/前缀）
      "description": "测试API接口",        // 指令描述
      "url": "https://api.example.com/user/{QQ}",  // webhook地址，支持{QQ}参数
      "method": "POST",                   // 请求方法：GET或POST
      "headers": {                        // 请求头，支持{QQ}参数
        "Authorization": "Bearer token",
        "X-User-QQ": "{QQ}",
        "Content-Type": "application/json"
      },
      "body": {                          // 请求体，支持{QQ}参数
        "user_id": "{QQ}",
        "action": "test",
        "amount": "{amount}",
        "type": "{type}",
        "data": {
          "qq": "{QQ}",
          "message": "Hello from QQ {QQ}"
        }
      },
      "timeout": 5000,                   // 请求超时时间（毫秒）
      "successCodes": [200, 201],        // 成功状态码列表
      "defaultParameters": [           // 默认参数配置（位置参数）
        {
          "name": "amount",
          "description": "操作金额",
          "required": true
        }
      ],
      "inputParameters": [              // 输入参数配置（选项参数）
        {
          "name": "type",
          "option": "t",
          "description": "操作类型",
          "required": false,
          "defaultValue": "normal"
        }
      ],
      "platform": "onebot",             // 指定使用onebot平台的机器人
      "botId": "123456789",             // 指定使用ID为123456789的机器人
      "enableSuccessReply": true,        // 是否启用成功回复
      "enableErrorReply": true,          // 是否启用失败回复
      "successMessage": "API调用成功！用户：{user.name}，积分：{points}，操作金额：{amount}，类型：{type}",   // 成功回复，支持响应参数和用户输入参数
      "errorMessage": "API调用失败：{error}"        // 失败回复，支持响应参数
    },
    {
      "command": "silent-action",
      "description": "静默操作（无回复）",
      "url": "https://api.example.com/silent",
      "method": "POST",
      "body": {
        "qq": "{QQ}",
        "action": "silent"
      },
      "successCodes": [200, 202],
      "enableSuccessReply": false,       // 不回复成功消息
      "enableErrorReply": true           // 只在失败时回复
    }
  ],
  "globalTimeout": 5000,                 // 全局超时时间（毫秒）
  "enableLogging": true                  // 是否启用详细日志
}
```

**使用示例**：
```bash
# 默认参数 + 选项参数的混合使用
/test-api 100              # 使用位置参数amount=100，type使用默认值normal
/test-api 100 -t premium   # 位置参数amount=100，选项参数type=premium

# 静默操作
/silent-action             # 不会回复任何消息

# 机器人指定使用
# 注意：webhook请求和回复都会通过指定的机器人执行
/test-api 100              # 通过onebot:123456789机器人执行和回复
```

### 配置说明

- **webhooks**：webhook配置列表，每个配置包含：
  - **command**：指令名称，用户将使用这个名称触发webhook（不需要 `/` 前缀）
  - **description**：指令描述，会显示在帮助信息中
  - **url**：webhook请求地址，支持 `{QQ}` 参数替换
  - **method**：HTTP请求方法，支持 `GET` 或 `POST`
  - **headers**：请求头对象，支持 `{QQ}` 参数替换
  - **body**：请求体对象，支持 `{QQ}` 参数替换
  - **timeout**：单个请求的超时时间（毫秒）
  - **successCodes**：成功状态码列表，默认为 `[200]`
  - **enableSuccessReply**：是否启用成功时的回复，默认为 `true`
  - **enableErrorReply**：是否启用失败时的回复，默认为 `true`
  - **successMessage**：请求成功时的回复消息，支持响应参数替换
  - **errorMessage**：请求失败时的回复消息，支持响应参数替换
  - **inputParameters**：输入参数配置列表（选项形式），每个参数包含：
    - **name**：参数名称，用于在请求中替换（如：`num`）
    - **option**：选项名称，用户输入时使用（如：`r`）
    - **description**：参数描述
    - **required**：是否必需参数，默认为 `false`
    - **defaultValue**：默认值
  - **defaultParameters**：默认参数配置列表（位置参数形式），每个参数包含：
    - **name**：参数名称，用于在请求中替换（如：`parameter`）
    - **description**：参数描述
    - **required**：是否必需参数，默认为 `false`
    - **defaultValue**：默认值
  - **platform**：机器人平台，支持 `onebot`、`kook`、`telegram`、`discord`、`lark`、`chronocat`，留空则使用触发指令的机器人
  - **botId**：机器人ID，用于获取指定的Bot对象，留空则使用触发指令的机器人

- **globalTimeout**：全局默认超时时间
- **enableLogging**：是否启用详细的请求日志

### 参数替换功能

#### {QQ} 参数替换

插件会自动将配置中的 `{QQ}` 替换为触发指令用户的QQ号。参数替换支持：

- URL中的参数：`https://api.example.com/user/{QQ}`
- 请求头中的参数：`"X-User-QQ": "{QQ}"`
- 请求体中的参数：`{"user_id": "{QQ}"}`
- 嵌套对象中的参数：`{"data": {"qq": "{QQ}"}}`
- 数组中的参数：`["user", "{QQ}", "data"]`

#### 用户输入参数替换

插件支持两种参数输入方式：**选项参数**（-option 形式）和**默认参数**（位置参数形式）

##### 1. 选项参数（inputParameters）

使用 `-选项` 的形式传入参数：

**配置示例**：
```json
{
  "command": "send-gift",
  "body": {
    "from": "{QQ}",
    "to": "{recipient}",
    "message": "{message}"
  },
  "inputParameters": [
    {
      "name": "message",    // 参数名称，用于替换 {message}
      "option": "m",        // 选项名称，用户使用 -m 传入
      "description": "赠送留言",
      "required": false,
      "defaultValue": "送你一份小礼物"
    }
  ]
}
```

**使用方式**：
```
/send-gift -m "生日快乐"
```

##### 2. 默认参数（defaultParameters）

使用"指令 参数"的简化形式，按位置传入参数：

**配置示例**：
```json
{
  "command": "transfer",
  "url": "https://api.example.com/transfer",
  "body": {
    "from_user": "{QQ}",
    "to_user": "{target}",
    "amount": "{amount}",
    "reason": "{reason}"
  },
  "defaultParameters": [
    {
      "name": "target",     // 参数名称，用于替换 {target}
      "description": "转账目标用户ID",
      "required": true      // 必需参数
    },
    {
      "name": "amount",
      "description": "转账金额",
      "required": true
    },
    {
      "name": "reason",
      "description": "转账原因",
      "required": false,
      "defaultValue": "无备注"  // 默认值
    }
  ]
}
```

**使用方式**：
```
/transfer 123456 100           # 使用默认原因
/transfer 123456 100 还款      # 指定原因
```

##### 3. {parameter} 通用模板

对于简单的单参数场景，可以使用 `{parameter}` 通用模板：

**配置示例**：
```json
{
  "command": "query-user",
  "body": {
    "target_user": "{parameter}",
    "requester": "{QQ}"
  },
  "defaultParameters": [
    {
      "name": "parameter",
      "description": "要查询的用户ID",
      "required": false,
      "defaultValue": "{QQ}"    // 默认查询自己
    }
  ]
}
```

**使用方式**：
```
/query-user              # 查询自己
/query-user 123456       # 查询指定用户
```

##### 4. 混合使用

可以同时配置默认参数和选项参数：

**配置示例**：
```json
{
  "defaultParameters": [
    {"name": "recipient", "required": true},
    {"name": "gift", "defaultValue": "flower"}
  ],
  "inputParameters": [
    {"name": "message", "option": "m", "defaultValue": "送你礼物"}
  ]
}
```

**使用方式**：
```
/send-gift 123456                    # 使用默认礼物和留言
/send-gift 123456 cake               # 指定礼物类型
/send-gift 123456 cake -m "生日快乐"  # 指定礼物和留言
```

**参数特性**：
- **必需参数**：设置 `required: true`，用户必须提供
- **可选参数**：设置 `required: false`（默认），用户可选择是否提供
- **默认值**：可设置 `defaultValue`，用户未提供时使用默认值
- **参数优先级**：选项参数优先于默认参数
- **参数验证**：必需参数未提供时会返回错误提示

#### 响应参数替换

回复消息支持使用API响应中的字段，插件会自动提取响应数据并支持参数替换：

**响应数据示例**：
```json
{
  "user": {
    "id": 12345,
    "name": "张三",
    "email": "zhangsan@example.com"
  },
  "data": {
    "status": "active",
    "points": 150,
    "result": {
      "message": "操作成功"
    }
  },
  "error": "未找到绑定该QQ号的用户"
}
```

**可用的参数替换**：
- `{user.id}` → `12345`
- `{user.name}` → `张三`
- `{user.email}` → `zhangsan@example.com`
- `{data.status}` → `active`
- `{data.points}` → `150`
- `{data.result.message}` → `操作成功`
- `{error}` → `未找到绑定该QQ号的用户`
- `{QQ}` → 用户的QQ号
- `{status}` → HTTP状态码

**消息配置示例**：
```json
{
  "successMessage": "查询成功！用户：{user.name}，积分：{data.points}",
  "errorMessage": "查询失败：{error}"
}
```

### 状态码检测

可以配置多个成功状态码，只有当响应状态码在 `successCodes` 列表中时，才会被认为是成功的请求：

```json
{
  "successCodes": [200, 201, 202],
  "successMessage": "操作成功，状态码：{status}",
  "errorMessage": "操作失败，状态码：{status}，错误：{error}"
}
```

### 可选回复控制

可以独立控制成功和失败时是否回复消息：

```json
{
  "enableSuccessReply": false,  // 成功时不回复
  "enableErrorReply": true      // 失败时才回复
}
```

### 智能请求头过滤

插件会自动检测请求头中包含的参数，**如果某个请求头的值包含未提供的可选参数，该请求头项将被完全移除**，不会发送到目标服务器。

#### 工作原理

1. **参数检测**：扫描每个请求头的值，查找 `{参数名}` 模式
2. **参数验证**：检查参数是否已提供（非空、非null、非undefined）
3. **智能过滤**：移除包含未提供参数的请求头项
4. **保留处理**：对包含所有已提供参数的请求头进行正常的参数替换

#### 示例

**配置**：
```json
{
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-token",
    "X-User-QQ": "{QQ}",
    "X-User-Token": "{token}",
    "X-Reason": "{reason}"
  },
  "inputParameters": [
    {
      "name": "token",
      "option": "t", 
      "description": "用户令牌",
      "required": false
    }
  ],
  "defaultParameters": [
    {
      "name": "reason",
      "description": "操作原因",
      "required": false
    }
  ]
}
```

**使用场景**：

1. **用户提供了所有参数**：
   ```bash
   /command -t abc123 "转账操作"
   ```
   **实际发送的请求头**：
   ```json
   {
     "Content-Type": "application/json",
     "Authorization": "Bearer your-api-token", 
     "X-User-QQ": "123456789",
     "X-User-Token": "abc123",
     "X-Reason": "转账操作"
   }
   ```

2. **用户只提供了部分参数**：
   ```bash
   /command "转账操作"
   ```
   **实际发送的请求头**：
   ```json
   {
     "Content-Type": "application/json",
     "Authorization": "Bearer your-api-token",
     "X-User-QQ": "123456789", 
     "X-Reason": "转账操作"
   }
   ```
   ⚠️ `X-User-Token` 被移除，因为 `{token}` 参数未提供

3. **用户没有提供任何可选参数**：
   ```bash
   /command
   ```
   **实际发送的请求头**：
   ```json
   {
     "Content-Type": "application/json",
     "Authorization": "Bearer your-api-token",
     "X-User-QQ": "123456789"
   }
   ```
   ⚠️ `X-User-Token` 和 `X-Reason` 都被移除

#### 日志信息

当有请求头被移除时，日志会显示详细信息：
```
原始请求头配置 (5项): {"Content-Type":"application/json",...}
实际发送的请求头 (3项): {"Content-Type":"application/json",...}
已移除 2 个包含未提供参数的请求头项
```

#### 适用场景

- **API认证**：某些API的认证头只在特定情况下需要
- **条件字段**：根据用户输入决定是否发送某些头部信息
- **可选元数据**：避免发送空值或无效的元数据头
- **第三方兼容**：一些第三方服务不接受包含占位符的请求头

### 机器人指定配置

可以配置指令使用特定的机器人来执行webhook请求和发送回复：

#### 1. 指定平台和ID
```json
{
  "command": "transfer",
  "platform": "onebot",
  "botId": "123456789",
  // ... 其他配置
}
```

#### 2. 仅指定平台
```json
{
  "command": "query-user",
  "platform": "kook",
  // 使用kook平台的任意可用机器人
}
```

#### 3. 仅指定ID
```json
{
  "command": "send-gift",
  "botId": "987654321",
  // 使用ID为987654321的任意平台机器人
}
```

#### 4. 自动选择（默认）
```json
{
  "command": "calc",
  // 不配置platform和botId，使用触发指令的机器人
}
```

**机器人选择优先级**：
1. **指定平台+ID**：查找 `platform:botId` 的精确匹配
2. **仅指定平台**：查找该平台的任意可用机器人
3. **仅指定ID**：查找该ID的任意平台机器人
4. **回退机制**：使用触发指令的机器人

**使用场景**：
- **跨平台支持**：QQ群触发指令，使用Telegram机器人执行
- **机器人分工**：不同指令使用不同的专用机器人
- **权限隔离**：敏感操作使用特定权限的机器人

## 使用方法

### 1. 配置指令

在插件配置中添加你需要的webhook配置。每个配置会自动注册为一个可用的指令。

### 2. 使用指令

配置完成后，用户可以直接使用配置的指令名称来触发webhook请求：

**无参数指令**：
```
/daily-sign
```

**默认参数指令（位置参数）**：
```
/transfer 123456 100                # 转账给123456，金额100
/transfer 123456 100 还款           # 转账给123456，金额100，原因"还款"
/query-user 789012                  # 查询用户789012
/calc "2+3*4"                      # 计算表达式
```

**选项参数指令**：
```
/send-gift -m "生日快乐"            # 带选项参数
```

**混合参数指令**：
```
/send-gift 123456 cake -m "生日快乐"  # 默认参数 + 选项参数
```

当用户（假设QQ号为123456）执行指令时，插件会：
1. 解析位置参数和选项参数
2. 将配置中的 `{QQ}` 替换为 `123456`，其他参数按配置替换
3. 发送HTTP请求到指定的webhook地址
4. 返回成功或失败的消息给用户

**参数使用规则**：
- **默认参数**：按位置顺序传入，必需参数必须提供
- **选项参数**：使用 `-选项` 形式，可任意顺序
- **参数优先级**：选项参数优先于默认参数
- **默认值**：未提供的可选参数使用默认值

### 3. 查看可用指令

使用内置的帮助指令查看所有可用的webhook指令：

```
/webhook-help
```

**帮助指令示例输出**：
```
可用的webhook指令:

/transfer <target> <amount> [reason] - 转账操作
  机器人: onebot:123456789
  位置参数:
    1. target - 转账目标用户ID (必需)
    2. amount - 转账金额 (必需)
    3. reason - 转账原因 (默认: 无备注)

/query-user [parameter] - 查询用户信息
  机器人: kook:自动
  位置参数:
    1. parameter - 要查询的用户ID (默认: {QQ})

/send-gift <recipient> [gift] [count] - 发送礼物
  机器人: 自动:987654321
  位置参数:
    1. recipient - 礼物接收者 (必需)
    2. gift - 礼物类型 (默认: flower)
    3. count - 数量 (默认: 1)
  选项参数:
    -m <message> - 赠送留言 (默认: 送你一份小礼物)

/calc <expr> - 简单计算器
  位置参数:
    1. expr - 计算表达式 (必需)

/kook-notify <content> - Kook平台通知
  机器人: kook:自动
  位置参数:
    1. content - 通知内容 (必需)
```

## 示例

### 示例1：智能请求头过滤功能

```json
{
  "webhooks": [
    {
      "command": "transfer",
      "description": "转账操作",
      "url": "https://api.example.com/transfer",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer token",
        "X-User-QQ": "{QQ}",
        "X-User-Token": "{userToken}",
        "X-Operation-Reason": "{reason}"
      },
      "body": {
        "from_user": "{QQ}",
        "to_user": "{target}",
        "amount": "{amount}",
        "reason": "{reason}"
      },
      "defaultParameters": [
        {
          "name": "target",
          "description": "转账目标用户ID",
          "required": true
        },
        {
          "name": "amount", 
          "description": "转账金额",
          "required": true
        },
        {
          "name": "reason",
          "description": "转账原因",
          "required": false,
          "defaultValue": "无备注"
        }
      ],
      "inputParameters": [
        {
          "name": "userToken",
          "option": "t",
          "description": "用户授权令牌（可选）",
          "required": false
        }
      ],
      "platform": "onebot",
      "botId": "123456789",
      "successCodes": [200],
      "successMessage": "💰 转账成功！\n📤 转给：{recipient.name}\n💵 金额：{amount}元\n📝 原因：{reason}\n💳 余额：{balance}元",
      "errorMessage": "❌ 转账失败：{error}"
    }
  ]
}
```

**使用方式**：
```bash
# 不提供可选参数userToken
/transfer 123456 100
# 请求头：{"Content-Type":"...","Authorization":"...","X-User-QQ":"123456789","X-Operation-Reason":"无备注"}
# ⚠️ X-User-Token 被自动移除

# 提供reason但不提供userToken  
/transfer 123456 100 还钱
# 请求头：{"Content-Type":"...","Authorization":"...","X-User-QQ":"123456789","X-Operation-Reason":"还钱"}
# ⚠️ X-User-Token 被自动移除

# 提供所有参数
/transfer 123456 100 还钱 -t abc123
# 请求头：{"Content-Type":"...","Authorization":"...","X-User-QQ":"123456789","X-User-Token":"abc123","X-Operation-Reason":"还钱"}
# ✅ 所有请求头都保留
```

**API响应示例**：
```json
{
  "recipient": {"name": "张三"},
  "amount": "100",
  "reason": "还钱",
  "balance": "1500"
}
```

### 示例2：{parameter}通用模板

```json
{
  "webhooks": [
    {
      "command": "query-user",
      "description": "查询用户信息",
      "url": "https://api.example.com/user/{QQ}/info",
      "method": "GET",
      "body": {
        "target_user": "{parameter}",
        "include_details": "true"
      },
      "defaultParameters": [
        {
          "name": "parameter",
          "description": "要查询的用户ID",
          "required": false,
          "defaultValue": "{QQ}"
        }
      ],
      "successMessage": "🏆 查询结果\n👤 用户：{user.name}\n🎖️ 等级：{user.level}\n💎 积分：{user.points}",
      "errorMessage": "查询失败：{error}"
    }
  ]
}
```

**使用方式**：
```
/query-user                     # 查询自己
/query-user 123456              # 查询指定用户
```

**特点**：`{parameter}` 是通用参数模板，适合单参数场景

### 示例3：混合参数（默认参数+选项参数）

```json
{
  "webhooks": [
    {
      "command": "send-gift",
      "description": "发送礼物",
      "url": "https://api.example.com/gift/send",
      "method": "POST",
      "body": {
        "from": "{QQ}",
        "to": "{recipient}",
        "gift_type": "{gift}",
        "quantity": "{count}",
        "message": "{message}"
      },
      "defaultParameters": [
        {
          "name": "recipient",
          "description": "礼物接收者",
          "required": true
        },
        {
          "name": "gift",
          "description": "礼物类型",
          "required": false,
          "defaultValue": "flower"
        },
        {
          "name": "count",
          "description": "数量",
          "required": false,
          "defaultValue": "1"
        }
      ],
      "inputParameters": [
        {
          "name": "message",
          "option": "m",
          "description": "赠送留言",
          "required": false,
          "defaultValue": "送你一份小礼物"
        }
      ],
      "successMessage": "🎁 礼物发送成功！\n👤 收件人：{recipient_name}\n🎨 礼物：{gift} x{count}\n💌 留言：{message}",
      "errorMessage": "发送失败：{error}"
    }
  ]
}
```

**使用方式**：
```
/send-gift 123456                    # 默认礼物和留言
/send-gift 123456 cake               # 指定礼物类型
/send-gift 123456 cake 3             # 指定礼物和数量
/send-gift 123456 -m "生日快乐"       # 默认礼物，自定义留言
/send-gift 123456 cake 3 -m "生日快乐" # 完整指定所有参数
```

**特点**：默认参数按位置传入，选项参数可在任意位置使用

### 示例4：必需参数示例

```json
{
  "webhooks": [
    {
      "command": "calc",
      "description": "简单计算器",
      "url": "https://api.example.com/calculate",
      "method": "POST",
      "body": {
        "expression": "{expr}",
        "user": "{QQ}"
      },
      "defaultParameters": [
        {
          "name": "expr",
          "description": "计算表达式",
          "required": true
        }
      ],
      "successMessage": "🧮 计算结果：{expr} = {result}",
      "errorMessage": "❌ 计算失败：{error}"
    }
  ]
}
```

**使用方式**：
```
/calc "2+3*4"           # 计算表达式
/calc "(10-2)*3"        # 带括号的表达式
```

**特点**：必需参数在未提供时会返回错误提示

### 示例5：机器人指定配置

```json
{
  "webhooks": [
    {
      "command": "kook-notify",
      "description": "Kook平台通知",
      "url": "https://api.example.com/notify",
      "method": "POST",
      "body": {
        "user": "{QQ}",
        "message": "{content}"
      },
      "defaultParameters": [
        {
          "name": "content",
          "description": "通知内容",
          "required": true
        }
      ],
      "platform": "kook",
      "successMessage": "✅ 通知已通过Kook机器人发送",
      "errorMessage": "❌ 通知发送失败"
    },
    {
      "command": "telegram-alert",
      "description": "Telegram告警",
      "url": "https://api.example.com/alert",
      "method": "POST",
      "body": {
        "source": "qq-{QQ}",
        "alert_level": "{level}",
        "message": "{msg}"
      },
      "defaultParameters": [
        {
          "name": "level",
          "description": "告警级别",
          "required": false,
          "defaultValue": "info"
        },
        {
          "name": "msg",
          "description": "告警消息",
          "required": true
        }
      ],
      "platform": "telegram",
      "botId": "1122334455",
      "successMessage": "🚨 告警已通过Telegram机器人发送",
      "errorMessage": "❌ 告警发送失败"
    }
  ]
}
```

**使用方式**：
```bash
# 在QQ群中执行，但使用Kook机器人处理
/kook-notify "系统维护通知"

# 在任意平台执行，使用指定的Telegram机器人处理
/telegram-alert "服务器异常"
/telegram-alert error "数据库连接失败"
```

**特点**：
- 跨平台执行：可以在QQ群触发指令，但使用其他平台的机器人
- 专用机器人：不同类型的操作使用专门的机器人
- 自动回退：找不到指定机器人时自动使用触发指令的机器人

## 日志和调试

当启用详细日志时（`enableLogging: true`），插件会记录：

- 指令触发信息
- 请求URL、方法、头信息
- 请求体内容
- 响应状态码和数据
- 错误信息

这些日志有助于调试webhook请求问题。

## 常见问题

1. **指令不生效？**
   - 检查配置中的 `command` 是否正确
   - 确保没有重复的指令名称
   - 检查koishi控制台是否有错误日志

2. **{QQ}参数没有被替换？**
   - 确保使用的是大写的 `{QQ}`
   - 检查用户是否有有效的userId

3. **响应参数没有被替换？**
   - 检查API是否返回了预期的JSON数据
   - 确认参数名拼写正确（区分大小写）
   - 对于嵌套字段，使用点号语法如 `{user.name}`
   - 启用详细日志查看实际的响应数据

4. **输入参数不生效？**
   - 检查 `inputParameters`（选项参数）配置是否正确
   - 确认参数名（`name`）和选项名（`option`）拼写正确
   - 必需参数未提供时会显示错误信息
   - 使用 `/webhook-help` 查看具体参数说明

5. **默认参数不生效？**
   - 检查 `defaultParameters`（位置参数）配置是否正确
   - 确认参数按位置顺序传入（第1个参数对应第1个配置）
   - 必需参数必须提供，可选参数可以省略
   - 参数数量不能超过配置的参数个数

6. **{parameter}模板不工作？**
   - 确保配置了名为 `parameter` 的默认参数
   - 检查请求体中是否使用了 `{parameter}` 模板
   - 可以设置默认值如 `{QQ}` 实现自引用

7. **必需参数报错？**
   - 确保提供了所有 `required: true` 的参数
   - 对于默认参数，按位置顺序提供必需参数
   - 对于选项参数，检查选项名是否正确（如 `-t` 而不是 `-target`）
   - 参数值不能为空字符串

8. **机器人配置不生效？**
   - 检查 `platform` 和 `botId` 配置是否正确
   - 确认指定的机器人已连接并在线
   - 查看日志中的机器人选择信息
   - 检查机器人是否有足够的权限执行操作

9. **找不到指定的机器人？**
   - 确认机器人ID和平台名称拼写正确
   - 检查机器人是否已正确配置并启动
   - 查看 Koishi 控制台中的机器人列表
   - 系统会自动回退到触发指令的机器人

10. **状态码检测不生效？**
    - 确认 `successCodes` 配置包含了API实际返回的状态码
    - 检查日志中显示的实际状态码
    - 注意有些API可能返回201、202等状态码

11. **不想收到回复消息？**
    - 设置 `enableSuccessReply: false` 禁用成功回复
    - 设置 `enableErrorReply: false` 禁用失败回复
    - 两者都设置为false可实现完全静默操作

12. **请求超时？**
    - 检查目标URL是否可达
    - 适当增加 `timeout` 配置
    - 检查网络连接

13. **请求头没有按预期发送？**
    - 检查参数是否正确提供（非空、非null、非undefined）
    - 查看日志中的"已移除 X 个包含未提供参数的请求头项"提示
    - 确认可选参数的配置是否正确
    - 记住：包含未提供参数的请求头会被自动移除

14. **如何禁用智能请求头过滤？**
    - 确保所有请求头中使用的参数都是必需的（`required: true`）
    - 或者给所有可选参数设置默认值（`defaultValue`）
    - 避免在请求头中使用可选且无默认值的参数

15. **如何测试webhook是否正常？**
    - 启用详细日志查看请求详情
    - 使用简单的测试接口（如httpbin.org）进行测试
    - 检查目标服务的日志
    - 先设置简单的成功/失败消息，确认基本功能正常后再添加参数替换
    - 从无参数指令开始测试，再逐步添加默认参数和选项参数
    - 测试机器人配置时，先确认机器人在线状态
    - 测试智能请求头过滤时，观察日志中的请求头对比信息

## 许可证

MIT 