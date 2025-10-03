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

  async downloadImageAsBase64(ctx, url, headers = {}) {
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", , "image/gif"];
    //10M
    const MAX_CONTENT_SIZE = 10485760;
    const image = await ctx.http(url, { responseType: "arraybuffer", headers });
    if (+image.headers.get("content-length") > MAX_CONTENT_SIZE) {
      throw new Error(".file-too-large");
    }
    const mimetype = image.headers.get("content-type");
    if (!ALLOWED_TYPES.includes(mimetype)) {
      throw new Error(".unsupported-file-type");
    }
    const buffer = image.data;
    const base64 = arrayBufferToBase64(buffer);
    return { buffer, base64, dataUrl: `data:${mimetype};base64,${base64}` };
  }
  hasSensitiveWords(text) {
    const lowercaseText = text.toLowerCase();
    const nsfwKeywords = [
      "nsfw",
      "nude",
      "porn",
      "hentai",
      "ecchi",
      "gore",
      "violence",
      "rape",
      "incest",
      "pedophile",
      "pussy",
      "cock",
      "dick",
      "vagina",
      "penis",
      "ass",
      "boobs",
      "tits",
      "cum",
      "anal",
      "masturbation",
      //  ... 这里可以添加更多你认为相关的关键词 ...
    ];
    for (const keyword of nsfwKeywords) {
      if (lowercaseText.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  getImage64Dimensions(base64String) {
    // 移除数据 URI 前缀
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    // 将 Base64 字符串转换为 Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    try {
      const dimensions = imageSize(imageBuffer);
      return { width: dimensions.width, height: dimensions.height };
    } catch (error) {
      this.ctx.logger.warn('无法获取图片尺寸:', error);
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