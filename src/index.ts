import { Context, Schema, h, Service, arrayBufferToBase64 } from 'koishi'

import imageSize from 'image-size';
import sharp from 'sharp';

export const name = 'gouqi-base'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

declare module 'koishi' {
  interface Context {
    "gouqi_base": GouqiBase
  }
}

export function apply(ctx, config) {
  // 注册服务
  ctx.plugin(GouqiBase);
}

export class GouqiBase extends Service {
  constructor(ctx: Context) {
    super(ctx, 'gouqi_base', true)
  }

  async downloadImageAsBase64(url, headers = {}) {
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    //10M
    const MAX_CONTENT_SIZE = 10485760;
    
    // 将返回值命名为 response，使其更清晰
    const response = await this.ctx.http(url, { responseType: "arraybuffer", headers });

    if (+response.headers.get("content-length") > MAX_CONTENT_SIZE) {
      throw new Error(".file-too-large");
    }
    const mimetype = response.headers.get("content-type");
    if (!ALLOWED_TYPES.includes(mimetype)) {
      throw new Error(".unsupported-file-type");
    }
    const buffer = Buffer.from(response.data); // 确保是 Buffer 类型
    const base64 = arrayBufferToBase64(buffer);
    return { buffer, base64, dataUrl: `data:${mimetype};base64,${base64}` };
  }

  hasSensitiveWords(input) {
    // 敏感词列表
    const nsfwKeywords = [
      "nsfw", "nude", "porn", "hentai", "ecchi", "gore", "violence",
      "rape", "incest", "pedophile", "pussy", "cock", "dick",
      "vagina", "penis", "ass", "boobs", "tits", "cum", "anal",
      "masturbation"
      //  ... 这里可以添加更多你认为相关的关键词 ...
    ];
  
    // 动态创建一个正则表达式：
    // - nsfwKeywords.join('|') 会生成一个 "nsfw|nude|porn|..." 的字符串，表示匹配其中任意一个词。
    // - \b 是单词边界，确保我们匹配的是整个单词，而不是单词的一部分。
    // - 'i' 标志表示不区分大小写进行匹配。
    const regex = new RegExp(`\\b(${nsfwKeywords.join('|')})\\b`, 'i');
  
    // 使用 regex.test() 来检查输入字符串是否匹配该模式。
    // .test() 方法性能很好，一旦找到匹配项就会立即返回 true。
    return regex.test(input);
  }

  getImage64Dimensions(base64String: string) {
    // 移除数据 URI 前缀
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    try {
      const dimensions = imageSize(imageBuffer);
      return { width: dimensions.width, height: dimensions.height };
    } catch (error) {
      this.ctx.logger.warn('无法获取图片尺寸:', error);
      return null;
    }
  }

  async resizeImage64(base64String, width, height) {
    //base64String = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
    // 提取 MIME 类型和 Base64 数据
    const parts = base64String.split(';');
    const mimeType = parts[0].split(':')[1];
    const imageData = parts[1].split(',')[1];
    const imgBuffer = Buffer.from(imageData, 'base64');
    try {
      // Use 'await' to wait for the promise from toBuffer() to resolve
      const resizedImageBuffer = await sharp(imgBuffer)
        .resize(width, height) // Set the new width and height
        .toBuffer();
      const resizedImageData = resizedImageBuffer.toString('base64');
      const resizedBase64 = `data:${mimeType};base64,${resizedImageData}`;
      return resizedBase64; // Optionally return the result
    } catch (error) {
      this.ctx.logger.warn('图片尺寸调整失败:', error);
    }
  }
}