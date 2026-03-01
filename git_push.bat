@echo off
git add .
set /p msg="請輸入提交訊息 (Commit Message): "
git commit -m "%msg%"
git push origin main
echo.
echo 上傳完成！
pause