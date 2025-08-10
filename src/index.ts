import { Bot, Context, Logger, Schema } from 'koishi'
import type { Session } from 'koishi'
import axios from 'axios'

export const name = 'webhook-sender'
export const inject = []

// webhook配置接口
export interface WebhookConfig {
    command: string                           // 指令名称
    description?: string                      // 指令描述
    url: string                              // webhook地址
    method: 'GET' | 'POST'                   // 请求方法
    headers?: { [key: string]: string }      // 请求头，支持{QQ}参数
    body?: { [key: string]: any }            // 请求体，支持{QQ}参数
    timeout?: number                         // 请求超时时间（毫秒）
    successMessage?: string                  // 成功时的回复消息
    errorMessage?: string                    // 失败时的回复消息
}

// 插件配置接口
export interface Config {
    webhooks: WebhookConfig[]                // webhook配置列表
    globalTimeout?: number                   // 全局超时时间（毫秒）
    enableLogging?: boolean                  // 是否启用详细日志
}

// 配置Schema
export const Config = Schema.object({
    webhooks: Schema.array(Schema.object({
        command: Schema.string().required().description('指令名称（不需要包含前缀/）'),
        description: Schema.string().description('指令描述'),
        url: Schema.string().required().description('webhook地址'),
        method: Schema.union(['GET', 'POST']).default('POST').description('请求方法'),
        headers: Schema.dict(Schema.string()).role('table').description('请求头，支持{QQ}参数替换'),
        body: Schema.dict(Schema.any()).role('table').description('请求体，支持{QQ}参数替换'),
        timeout: Schema.number().default(5000).description('请求超时时间（毫秒）'),
        successMessage: Schema.string().default('请求发送成功').description('成功时的回复消息'),
        errorMessage: Schema.string().default('请求发送失败').description('失败时的回复消息')
    })).description('webhook配置列表'),
    globalTimeout: Schema.number().default(5000).description('全局请求超时时间（毫秒）'),
    enableLogging: Schema.boolean().default(true).description('是否启用详细日志')
})

// 替换字符串中的{QQ}参数
function replaceQQParameter(input: any, qq: string): any {
    if (typeof input === 'string') {
        return input.replace(/\{QQ\}/g, qq);
    } else if (Array.isArray(input)) {
        return input.map(item => replaceQQParameter(item, qq));
    } else if (typeof input === 'object' && input !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(input)) {
            result[replaceQQParameter(key, qq)] = replaceQQParameter(value, qq);
        }
        return result;
    }
    return input;
}

// 发送webhook请求
async function sendWebhook(webhookConfig: WebhookConfig, qq: string, logger: Logger): Promise<{ success: boolean, message: string }> {
    try {
        // 替换URL中的{QQ}参数
        const url = replaceQQParameter(webhookConfig.url, qq);
        
        // 替换请求头中的{QQ}参数
        const headers = webhookConfig.headers ? replaceQQParameter(webhookConfig.headers, qq) : {};
        
        // 替换请求体中的{QQ}参数
        const body = webhookConfig.body ? replaceQQParameter(webhookConfig.body, qq) : {};
        
        // 设置超时时间
        const timeout = webhookConfig.timeout || 5000;
        
        logger.info(`准备发送webhook请求到: ${url}`);
        logger.info(`请求方法: ${webhookConfig.method}`);
        logger.info(`请求头: ${JSON.stringify(headers, null, 2)}`);
        if (webhookConfig.method === 'POST') {
            logger.info(`请求体: ${JSON.stringify(body, null, 2)}`);
        }
        
        // 发送请求
        const response = await axios({
            method: webhookConfig.method,
            url: url,
            headers: headers,
            data: webhookConfig.method === 'POST' ? body : undefined,
            params: webhookConfig.method === 'GET' ? body : undefined,
            timeout: timeout,
            validateStatus: (status) => status < 500 // 接受所有小于500的状态码
        });
        
        logger.info(`Webhook请求成功，状态码: ${response.status}`);
        logger.info(`响应数据: ${JSON.stringify(response.data, null, 2)}`);
        
        return {
            success: true,
            message: webhookConfig.successMessage || '请求发送成功'
        };
        
    } catch (error: any) {
        logger.error(`Webhook请求失败: ${error.message}`);
        if (error.response) {
            logger.error(`响应状态码: ${error.response.status}`);
            logger.error(`响应数据: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        
        return {
            success: false,
            message: webhookConfig.errorMessage || `请求发送失败: ${error.message}`
        };
    }
}

export function apply(ctx: Context, config: Config) {
    const logger = ctx.logger(name);
    
    // 检查配置
    if (!config.webhooks || config.webhooks.length === 0) {
        logger.warn('未配置任何webhook，插件将不会注册任何指令');
        return;
    }
    
    // 为每个webhook配置注册指令
    for (const webhookConfig of config.webhooks) {
        const commandName = webhookConfig.command;
        const description = webhookConfig.description || `发送webhook请求到 ${webhookConfig.url}`;
        
        logger.info(`注册指令: ${commandName}`);
        
        ctx.command(commandName, description)
            .action(async ({ session }) => {
                if (!session) {
                    return '无法获取会话信息';
                }
                
                // 获取用户QQ号
                let qq: string;
                if (session.userId) {
                    qq = session.userId;
                } else {
                    return '无法获取用户QQ号';
                }
                
                logger.info(`用户 ${qq} 触发了指令 ${commandName}`);
                
                // 发送webhook请求
                const result = await sendWebhook(webhookConfig, qq, logger);
                
                return result.message;
            });
    }
    
    // 注册帮助指令
    ctx.command('webhook-help', '查看所有可用的webhook指令')
        .action(() => {
            if (config.webhooks.length === 0) {
                return '当前没有配置任何webhook指令';
            }
            
            let helpText = '可用的webhook指令:\n\n';
            for (const webhookConfig of config.webhooks) {
                helpText += `/${webhookConfig.command}`;
                if (webhookConfig.description) {
                    helpText += ` - ${webhookConfig.description}`;
                }
                helpText += '\n';
            }
            
            return helpText.trim();
        });
    
    logger.info(`插件加载完成，已注册 ${config.webhooks.length} 个webhook指令`);
}