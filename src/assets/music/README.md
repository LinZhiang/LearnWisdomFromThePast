# 背景音乐资源

将音频文件按文件夹分类放在此目录下，例如：

```
music/
  轻音乐/
    track1.mp3
  游戏/
    bgm.wav
```

支持常见格式：**mp3、wav、ogg、m4a、flac、aac**（浏览器原生可播）。

若放入 RealLive 的 **`.nwa`** 或 Siglus 的 **`.owp`**，请先在本项目根目录执行：

```bash
npm run music:convert-for-web
```

脚本会把 `.nwa` 转为 `.wav`、`.owp` 转为 `.ogg` 并删除原文件。**`.mid` / `.midi`** 无法自动转换，请自行导出为上述格式后再放入。

添加或更换文件后需重新运行开发服务或重新构建，才能在设置页的树形下拉框中看到。
