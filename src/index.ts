import { Bot, Context, Logger, Schema } from 'koishi'
import type { Session } from 'koishi'
import axios from 'axios'

export const name = 'webhook-sender'
export const inject = []

// 输入参数配置接口
export interface InputParameter {
    name: string                             // 参数名称，如 'num'
    option: string                           // 选项名称，如 'r'
    description?: string                     // 参数描述
    required?: boolean                       // 是否必需，默认false
    defaultValue?: string                    // 默认值
}

// 默认参数配置接口
export interface DefaultParameter {
    name: string                             // 参数名称，用于模板替换
    description?: string                     // 参数描述
    required?: boolean                       // 是否必需，默认false
    defaultValue?: string                    // 默认值
}

// webhook配置接口
export interface WebhookConfig {
    command: string                           // 指令名称
    description?: string                      // 指令描述
    url: string                              // webhook地址
    method: 'GET' | 'POST'                   // 请求方法
    headers?: { [key: string]: string }      // 请求头，支持{QQ}和自定义参数
    body?: { [key: string]: any }            // 请求体，支持{QQ}和自定义参数
    timeout?: number                         // 请求超时时间（毫秒）
    successCodes?: number[]                  // 成功状态码列表，默认为[200]
    enableSuccessReply?: boolean             // 是否启用成功回复，默认true
    enableErrorReply?: boolean               // 是否启用失败回复，默认true
    successMessage?: string                  // 成功时的回复消息，支持响应参数替换
    errorMessage?: string                    // 失败时的回复消息，支持响应参数替换
    inputParameters?: InputParameter[]       // 输入参数配置（选项形式）
    defaultParameters?: DefaultParameter[]   // 默认参数配置（位置参数形式）
    platform?: string                       // 机器人平台
    botId?: string                          // 机器人ID，用于获取Bot对象
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
        headers: Schema.dict(Schema.string()).role('table').description('请求头，支持{QQ}参数和自定义参数替换'),
        body: Schema.dict(Schema.any()).role('table').description('请求体，支持{QQ}参数和自定义参数替换'),
        timeout: Schema.number().default(5000).description('请求超时时间（毫秒）'),
        successCodes: Schema.array(Schema.number()).default([200]).description('成功状态码列表'),
        enableSuccessReply: Schema.boolean().default(true).description('是否启用成功时的回复'),
        enableErrorReply: Schema.boolean().default(true).description('是否启用失败时的回复'),
        successMessage: Schema.string().default('请求发送成功').description('成功时的回复消息，支持响应参数替换'),
        errorMessage: Schema.string().default('请求发送失败').description('失败时的回复消息，支持响应参数替换'),
        inputParameters: Schema.array(Schema.object({
            name: Schema.string().required().description('参数名称，用于在请求中替换（如：num）'),
            option: Schema.string().required().description('选项名称，用户输入时使用（如：r）'),
            description: Schema.string().description('参数描述'),
            required: Schema.boolean().default(false).description('是否必需参数'),
            defaultValue: Schema.string().description('默认值')
        })).description('输入参数配置（选项形式，如 -r value）'),
        defaultParameters: Schema.array(Schema.object({
            name: Schema.string().required().description('参数名称，用于在请求中替换（如：parameter）'),
            description: Schema.string().description('参数描述'),
            required: Schema.boolean().default(false).description('是否必需参数，默认为false'),
            defaultValue: Schema.string().description('默认值')
        })).description('默认参数配置（位置参数形式，如 command arg1 arg2）'),
        platform: Schema.union(['onebot', 'kook', 'telegram', 'discord', 'lark', 'chronocat']).description('机器人平台，留空则使用触发指令的机器人'),
        botId: Schema.string().description('机器人ID，用于获取指定的Bot对象，留空则使用触发指令的机器人')
    })).description('webhook配置列表'),
    globalTimeout: Schema.number().default(5000).description('全局请求超时时间（毫秒）'),
    enableLogging: Schema.boolean().default(true).description('是否启用详细日志')
})

// 替换字符串中的参数
function replaceParameters(input: any, replacements: { [key: string]: any }): any {
    if (typeof input === 'string') {
        let result = input;
        for (const [key, value] of Object.entries(replacements)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            result = result.replace(regex, String(value));
        }
        return result;
    } else if (Array.isArray(input)) {
        return input.map(item => replaceParameters(item, replacements));
    } else if (typeof input === 'object' && input !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(input)) {
            result[replaceParameters(key, replacements)] = replaceParameters(value, replacements);
        }
        return result;
    }
    return input;
}

// 检查字符串中是否包含未提供的参数模板
function containsUnprovidedParameters(input: string, providedParams: Set<string>): boolean {
    // 匹配所有 {参数名} 的模式
    const paramPattern = /\{([^}]+)\}/g;
    let match;
    
    while ((match = paramPattern.exec(input)) !== null) {
        const paramName = match[1];
        if (!providedParams.has(paramName)) {
            return true; // 发现未提供的参数
        }
    }
    
    return false; // 所有参数都已提供
}

// 智能处理请求头，移除包含未提供可选参数的头项
function processHeaders(headers: { [key: string]: string } | undefined, allParams: { [key: string]: any }, webhookConfig: WebhookConfig): { [key: string]: string } {
    if (!headers) {
        return {};
    }
    
    // 构建已提供参数的集合
    const providedParams = new Set<string>();
    
    // QQ参数总是提供的
    providedParams.add('QQ');
    
    // 添加用户提供的参数
    for (const paramName of Object.keys(allParams)) {
        if (allParams[paramName] !== undefined && allParams[paramName] !== null && allParams[paramName] !== '') {
            providedParams.add(paramName);
        }
    }
    
    // 处理每个请求头
    const processedHeaders: { [key: string]: string } = {};
    
    for (const [headerName, headerValue] of Object.entries(headers)) {
        if (typeof headerValue === 'string') {
            // 检查该请求头的值是否包含未提供的参数
            if (!containsUnprovidedParameters(headerValue, providedParams)) {
                // 所有参数都已提供，执行参数替换并保留该请求头
                processedHeaders[headerName] = replaceParameters(headerValue, allParams);
            }
            // 如果包含未提供的参数，则不添加该请求头（即移除）
        } else {
            // 非字符串类型的值直接保留
            processedHeaders[headerName] = String(headerValue);
        }
    }
    
    return processedHeaders;
}

// 从响应数据中提取参数（支持嵌套访问）
function extractResponseParameters(responseData: any): { [key: string]: any } {
    const params: { [key: string]: any } = {};
    
    function extractRecursive(obj: any, prefix: string = '') {
        if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                params[fullKey] = value;
                
                // 如果值是对象，继续递归
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    extractRecursive(value, fullKey);
                }
            }
        }
    }
    
    extractRecursive(responseData);
    return params;
}

// 处理用户输入参数（选项形式）
function processInputParameters(inputParams: InputParameter[], userOptions: any): { [key: string]: any } {
    const result: { [key: string]: any } = {};
    
    for (const param of inputParams) {
        let value = userOptions[param.option];
        
        // 如果用户没有提供值，使用默认值
        if (value === undefined) {
            if (param.defaultValue !== undefined) {
                value = param.defaultValue;
            } else if (param.required) {
                throw new Error(`必需参数 -${param.option} 未提供`);
            }
        }
        
        // 只有当值存在时才添加到结果中
        if (value !== undefined) {
            result[param.name] = value;
        }
    }
    
    return result;
}

// 处理默认参数（位置参数形式）
function processDefaultParameters(defaultParams: DefaultParameter[], positionalArgs: string[]): { [key: string]: any } {
    const result: { [key: string]: any } = {};
    
    for (let i = 0; i < defaultParams.length; i++) {
        const param = defaultParams[i];
        let value = positionalArgs[i];
        
        // 如果用户没有提供值，使用默认值
        if (value === undefined) {
            if (param.defaultValue !== undefined) {
                value = param.defaultValue;
            } else if (param.required) {
                throw new Error(`必需参数 ${param.name} (位置 ${i + 1}) 未提供`);
            }
        }
        
        // 只有当值存在时才添加到结果中
        if (value !== undefined) {
            result[param.name] = value;
        }
    }
    
    return result;
}

// 获取指定的机器人
function getTargetBot(ctx: Context, webhookConfig: WebhookConfig, session: Session, logger: Logger): Bot | null {
    // 如果配置了特定的机器人平台和ID，则查找指定的机器人
    if (webhookConfig.platform && webhookConfig.botId) {
        const targetBotId = `${webhookConfig.platform}:${webhookConfig.botId}`;
        const targetBot = ctx.bots[targetBotId];
        
        if (targetBot) {
            logger.info(`使用指定的机器人: ${targetBotId}`);
            return targetBot;
        } else {
            logger.warn(`找不到指定的机器人: ${targetBotId}，回退到触发指令的机器人`);
        }
    }
    
    // 如果只配置了平台，查找该平台的任意可用机器人
    if (webhookConfig.platform && !webhookConfig.botId) {
        for (const bot of ctx.bots) {
            if (bot.platform === webhookConfig.platform) {
                logger.info(`使用平台 ${webhookConfig.platform} 的机器人: ${bot.platform}:${bot.selfId}`);
                return bot;
            }
        }
        logger.warn(`找不到平台 ${webhookConfig.platform} 的机器人，回退到触发指令的机器人`);
    }
    
    // 如果只配置了botId，查找该ID的任意平台机器人
    if (!webhookConfig.platform && webhookConfig.botId) {
        for (const bot of ctx.bots) {
            if (bot.selfId === webhookConfig.botId) {
                logger.info(`使用ID为 ${webhookConfig.botId} 的机器人: ${bot.platform}:${bot.selfId}`);
                return bot;
            }
        }
        logger.warn(`找不到ID为 ${webhookConfig.botId} 的机器人，回退到触发指令的机器人`);
    }
    
    // 回退到触发指令的机器人
    const fallbackBotId = `${session.platform}:${session.selfId}`;
    const fallbackBot = ctx.bots[fallbackBotId];
    
    if (fallbackBot) {
        logger.info(`使用触发指令的机器人: ${fallbackBotId}`);
        return fallbackBot;
    }
    
    logger.error(`找不到任何可用的机器人`);
    return null;
}

// 发送webhook请求
async function sendWebhook(webhookConfig: WebhookConfig, qq: string, userInputParams: { [key: string]: any }, logger: Logger): Promise<{ success: boolean, message: string }> {
    try {
        // 构建所有参数的替换对象
        const allParams = { QQ: qq, ...userInputParams };
        
        // 替换URL中的参数
        const url = replaceParameters(webhookConfig.url, allParams);
        
        // 智能处理请求头，移除包含未提供可选参数的头项
        const headers = processHeaders(webhookConfig.headers, allParams, webhookConfig);
        
        // 替换请求体中的参数
        const body = webhookConfig.body ? replaceParameters(webhookConfig.body, allParams) : {};
        
        // 设置超时时间
        const timeout = webhookConfig.timeout || 5000;
        
        logger.info(`准备发送webhook请求到: ${url}`);
        logger.info(`请求方法: ${webhookConfig.method}`);
        logger.info(`用户输入参数: ${JSON.stringify(userInputParams, null, 2)}`);
        
        // 显示原始配置的请求头和实际发送的请求头对比
        if (webhookConfig.headers) {
            const originalHeaderCount = Object.keys(webhookConfig.headers).length;
            const processedHeaderCount = Object.keys(headers).length;
            
            if (originalHeaderCount !== processedHeaderCount) {
                logger.info(`原始请求头配置 (${originalHeaderCount}项): ${JSON.stringify(webhookConfig.headers, null, 2)}`);
                logger.info(`实际发送的请求头 (${processedHeaderCount}项): ${JSON.stringify(headers, null, 2)}`);
                logger.info(`已移除 ${originalHeaderCount - processedHeaderCount} 个包含未提供参数的请求头项`);
            } else {
                logger.info(`请求头: ${JSON.stringify(headers, null, 2)}`);
            }
        } else {
            logger.info(`请求头: ${JSON.stringify(headers, null, 2)}`);
        }
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
            validateStatus: () => true // 接受所有状态码，由我们自己判断成功失败
        });
        
        logger.info(`Webhook请求完成，状态码: ${response.status}`);
        logger.info(`响应数据: ${JSON.stringify(response.data, null, 2)}`);
        
        // 检查状态码是否在成功列表中
        const successCodes = webhookConfig.successCodes || [200];
        const isSuccess = successCodes.includes(response.status);
        
        // 提取响应参数用于消息替换
        const responseParams = extractResponseParameters(response.data);
        
        // 构建消息替换参数（包含用户输入参数、QQ、状态码和响应参数）
        const messageParams = { ...allParams, status: response.status, ...responseParams };
        
        if (isSuccess) {
            // 请求成功
            if (webhookConfig.enableSuccessReply !== false) {
                const message = replaceParameters(
                    webhookConfig.successMessage || '请求发送成功',
                    messageParams
                );
                return { success: true, message };
            } else {
                return { success: true, message: '' }; // 不回复消息
            }
        } else {
            // 请求失败（状态码不在成功列表中）
            if (webhookConfig.enableErrorReply !== false) {
                const message = replaceParameters(
                    webhookConfig.errorMessage || `请求失败，状态码: ${response.status}`,
                    messageParams
                );
                return { success: false, message };
            } else {
                return { success: false, message: '' }; // 不回复消息
            }
        }
        
    } catch (error: any) {
        logger.error(`Webhook请求失败: ${error.message}`);
        if (error.response) {
            logger.error(`响应状态码: ${error.response.status}`);
            logger.error(`响应数据: ${JSON.stringify(error.response.data, null, 2)}`);
            
            // 即使是网络错误，也尝试从错误响应中提取参数
            const responseParams = error.response.data ? extractResponseParameters(error.response.data) : {};
            const messageParams = { QQ: qq, ...userInputParams, status: error.response.status, error: error.message, ...responseParams };
            
            if (webhookConfig.enableErrorReply !== false) {
                const message = replaceParameters(
                    webhookConfig.errorMessage || `请求发送失败: ${error.message}`,
                    messageParams
                );
                return { success: false, message };
            } else {
                return { success: false, message: '' };
            }
        } else {
            // 网络错误等情况
            const messageParams = { QQ: qq, ...userInputParams, error: error.message };
            
            if (webhookConfig.enableErrorReply !== false) {
                const message = replaceParameters(
                    webhookConfig.errorMessage || `请求发送失败: ${error.message}`,
                    messageParams
                );
                return { success: false, message };
            } else {
                return { success: false, message: '' };
            }
        }
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
        
        // 构建指令参数签名
        let commandSignature = commandName;
        if (webhookConfig.defaultParameters && webhookConfig.defaultParameters.length > 0) {
            const paramNames = webhookConfig.defaultParameters.map(param => {
                if (param.required) {
                    return `<${param.name}>`;
                } else {
                    return `[${param.name}]`;
                }
            });
            commandSignature += ' ' + paramNames.join(' ');
        }
        
        // 创建指令
        let command = ctx.command(commandSignature, description);
        
        // 如果配置了选项参数，添加选项
        if (webhookConfig.inputParameters && webhookConfig.inputParameters.length > 0) {
            for (const param of webhookConfig.inputParameters) {
                const optionConfig: any = {};
                if (param.defaultValue !== undefined) {
                    optionConfig.fallback = param.defaultValue;
                }
                
                command = command.option(param.option, `-${param.option} <${param.name}>`, optionConfig);
                
                if (param.description) {
                    logger.info(`  添加选项: -${param.option} <${param.name}> ${param.description}${param.required ? ' (必需)' : ''}${param.defaultValue ? ` (默认: ${param.defaultValue})` : ''}`);
                }
            }
        }
        
        // 如果配置了默认参数，记录参数信息
        if (webhookConfig.defaultParameters && webhookConfig.defaultParameters.length > 0) {
            for (const param of webhookConfig.defaultParameters) {
                logger.info(`  默认参数: ${param.name} ${param.description || ''}${param.required ? ' (必需)' : ''}${param.defaultValue ? ` (默认: ${param.defaultValue})` : ''}`);
            }
        }
        
        // 记录机器人配置信息
        if (webhookConfig.platform || webhookConfig.botId) {
            logger.info(`  机器人配置: 平台=${webhookConfig.platform || '自动'}, ID=${webhookConfig.botId || '自动'}`);
        }
        
        command.action(async ({ session, options }: { session?: Session, options?: any }, ...args: string[]) => {
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
            
            logger.info(`用户 ${qq} 触发了指令 ${commandName}，位置参数: [${args.join(', ')}]`);
            
            try {
                // 获取目标机器人
                const targetBot = getTargetBot(ctx, webhookConfig, session, logger);
                if (!targetBot) {
                    return '无法找到可用的机器人执行此指令';
                }
                
                // 处理选项参数
                const optionParams = webhookConfig.inputParameters 
                    ? processInputParameters(webhookConfig.inputParameters, options || {})
                    : {};
                
                // 处理默认参数（位置参数）
                const defaultParams = webhookConfig.defaultParameters
                    ? processDefaultParameters(webhookConfig.defaultParameters, args)
                    : {};
                
                // 合并所有用户输入参数，选项参数优先
                const userInputParams = { ...defaultParams, ...optionParams };
                
                logger.info(`处理后的参数: ${JSON.stringify(userInputParams, null, 2)}`);
                
                // 发送webhook请求
                const result = await sendWebhook(webhookConfig, qq, userInputParams, logger);
                
                // 只有在有消息内容时才回复，并使用指定的机器人回复
                if (result.message) {
                    // 确定回复的会话ID
                    let replySessionId: string;
                    if (session.subtype === 'group') {
                        replySessionId = session.channelId || session.userId || 'unknown';
                    } else if (session.subtype === 'private') {
                        replySessionId = `private:${session.userId || 'unknown'}`;
                    } else {
                        replySessionId = session.guildId ? (session.channelId || 'unknown') : `private:${session.userId || 'unknown'}`;
                    }
                    
                    // 使用目标机器人发送回复
                    await targetBot.createMessage(replySessionId, result.message);
                    return; // 不返回消息，避免重复回复
                }
                
                return undefined;
                
            } catch (error: any) {
                logger.error(`处理指令 ${commandName} 时出错: ${error.message}`);
                return error.message;
            }
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
                // 构建指令使用示例
                let commandUsage = `/${webhookConfig.command}`;
                
                // 添加默认参数示例
                if (webhookConfig.defaultParameters && webhookConfig.defaultParameters.length > 0) {
                    const paramExamples = webhookConfig.defaultParameters.map(param => {
                        if (param.required) {
                            return `<${param.name}>`;
                        } else {
                            return `[${param.name}]`;
                        }
                    });
                    commandUsage += ' ' + paramExamples.join(' ');
                }
                
                helpText += commandUsage;
                if (webhookConfig.description) {
                    helpText += ` - ${webhookConfig.description}`;
                }
                
                // 添加机器人信息
                if (webhookConfig.platform || webhookConfig.botId) {
                    helpText += `\n  机器人: ${webhookConfig.platform || '自动'}:${webhookConfig.botId || '自动'}`;
                }
                
                // 添加默认参数说明
                if (webhookConfig.defaultParameters && webhookConfig.defaultParameters.length > 0) {
                    helpText += '\n  位置参数:';
                    for (let i = 0; i < webhookConfig.defaultParameters.length; i++) {
                        const param = webhookConfig.defaultParameters[i];
                        helpText += `\n    ${i + 1}. ${param.name}`;
                        if (param.description) {
                            helpText += ` - ${param.description}`;
                        }
                        if (param.required) {
                            helpText += ' (必需)';
                        }
                        if (param.defaultValue) {
                            helpText += ` (默认: ${param.defaultValue})`;
                        }
                    }
                }
                
                // 添加选项参数说明
                if (webhookConfig.inputParameters && webhookConfig.inputParameters.length > 0) {
                    helpText += '\n  选项参数:';
                    for (const param of webhookConfig.inputParameters) {
                        helpText += `\n    -${param.option} <${param.name}>`;
                        if (param.description) {
                            helpText += ` - ${param.description}`;
                        }
                        if (param.required) {
                            helpText += ' (必需)';
                        }
                        if (param.defaultValue) {
                            helpText += ` (默认: ${param.defaultValue})`;
                        }
                    }
                }
                
                helpText += '\n\n';
            }
            
            return helpText.trim();
        });
    
    logger.info(`插件加载完成，已注册 ${config.webhooks.length} 个webhook指令`);
}