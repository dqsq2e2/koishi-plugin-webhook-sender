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
- 可配置请求超时时间
- 可配置成功和失败时的回复消息
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
        "data": {
          "qq": "{QQ}",
          "message": "Hello from QQ {QQ}"
        }
      },
      "timeout": 5000,                   // 请求超时时间（毫秒）
      "successMessage": "API调用成功！",   // 成功时的回复
      "errorMessage": "API调用失败"        // 失败时的回复
    },
    {
      "command": "notify",
      "description": "发送通知",
      "url": "https://webhook.example.com/notify",
      "method": "GET",
      "headers": {
        "User-Agent": "Koishi-Bot-{QQ}"
      },
      "body": {
        "qq": "{QQ}",
        "timestamp": "{{timestamp}}"      // 可以使用其他占位符
      }
    }
  ],
  "globalTimeout": 5000,                 // 全局超时时间（毫秒）
  "enableLogging": true                  // 是否启用详细日志
}
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
  - **successMessage**：请求成功时的回复消息
  - **errorMessage**：请求失败时的回复消息

- **globalTimeout**：全局默认超时时间
- **enableLogging**：是否启用详细的请求日志

### {QQ} 参数替换

插件会自动将配置中的 `{QQ}` 替换为触发指令用户的QQ号。参数替换支持：

- URL中的参数：`https://api.example.com/user/{QQ}`
- 请求头中的参数：`"X-User-QQ": "{QQ}"`
- 请求体中的参数：`{"user_id": "{QQ}"}`
- 嵌套对象中的参数：`{"data": {"qq": "{QQ}"}}`
- 数组中的参数：`["user", "{QQ}", "data"]`

## 使用方法

### 1. 配置指令

在插件配置中添加你需要的webhook配置。每个配置会自动注册为一个可用的指令。

### 2. 使用指令

配置完成后，用户可以直接使用配置的指令名称来触发webhook请求：

```
/test-api
```

当用户（假设QQ号为123456）执行此指令时，插件会：
1. 将配置中的 `{QQ}` 替换为 `123456`
2. 发送HTTP请求到指定的webhook地址
3. 返回成功或失败的消息给用户

### 3. 查看可用指令

使用内置的帮助指令查看所有可用的webhook指令：

```
/webhook-help
```

## 示例

### 示例1：简单的API调用

```json
{
  "webhooks": [
    {
      "command": "check-status",
      "description": "检查用户状态",
      "url": "https://api.myservice.com/status",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer your-token"
      },
      "body": {
        "qq": "{QQ}",
        "action": "status_check"
      },
      "successMessage": "状态检查完成",
      "errorMessage": "状态检查失败，请稍后重试"
    }
  ]
}
```

使用方法：
```
/check-status
```

### 示例2：GET请求with参数

```json
{
  "webhooks": [
    {
      "command": "get-info",
      "description": "获取用户信息",
      "url": "https://api.myservice.com/userinfo",
      "method": "GET",
      "headers": {
        "X-User-QQ": "{QQ}"
      },
      "body": {
        "user_id": "{QQ}",
        "format": "json"
      }
    }
  ]
}
```

使用方法：
```
/get-info
```

### 示例3：复杂的嵌套参数

```json
{
  "webhooks": [
    {
      "command": "complex-api",
      "description": "复杂API调用",
      "url": "https://api.example.com/v1/users/{QQ}/action",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json",
        "X-Request-ID": "req-{QQ}-{{timestamp}}"
      },
      "body": {
        "user": {
          "qq": "{QQ}",
          "platform": "koishi"
        },
        "metadata": {
          "source": "qq-{QQ}",
          "tags": ["user-{QQ}", "bot-request"]
        }
      }
    }
  ]
}
```

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

3. **请求超时？**
   - 检查目标URL是否可达
   - 适当增加 `timeout` 配置
   - 检查网络连接

4. **如何测试webhook是否正常？**
   - 启用详细日志查看请求详情
   - 使用简单的测试接口（如httpbin.org）进行测试
   - 检查目标服务的日志

## 许可证

MIT 