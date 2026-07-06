@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   推送代码到 GitHub
echo ========================================
echo.

cd /d "D:\AI_work\工具与模板\myweb\github-pages"

echo 正在推送...
git push -u origin main

if %errorlevel%==0 (
    echo.
    echo ========================================
    echo   推送成功！
    echo ========================================
    echo.
    echo 下一步：打开 GitHub 仓库设置开启 Pages
    echo https://github.com/wenpinglin/wenpinglin.github.io/settings/pages
) else (
    echo.
    echo 推送失败，请检查网络或 GitHub 登录状态
)

echo.
pause
