/**
 * HTML Response Templates for OAuth
 */

export interface SuccessTokenData {
  expires_in: number;
  scope: string[];
}

/**
 * Generate success HTML response
 */
export function generateSuccessHTML(data: SuccessTokenData): string {
  const hoursUntilExpiry = Math.floor(
    (data.expires_in - Date.now() / 1000) / 60,
  );
  const scopeCount = data.scope.length;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Авторизация успешна</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .success-icon {
      font-size: 60px;
      color: #4CAF50;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    .info {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
      text-align: left;
    }
    .info p {
      margin: 5px 0;
      color: #666;
    }
    .close-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      margin-top: 20px;
    }
    .close-btn:hover {
      background: #764ba2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>
    <h1>Авторизация успешна!</h1>
    <div class="info">
      <p><strong>Токен получен</strong></p>
      <p>Истекает через: ${hoursUntilExpiry} минут</p>
      <p>Разрешений: ${scopeCount}</p>
    </div>
    <p style="color: #666; font-size: 14px;">
      Токен сохранён и будет автоматически обновляться.<br>
      Вы можете закрыть эту страницу.
    </p>
    <button class="close-btn" onclick="window.close()">Закрыть</button>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate error HTML response
 */
export function generateErrorHTML(errorMessage: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ошибка авторизации</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .error-icon {
      font-size: 60px;
      color: #f44336;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 20px;
    }
    .error-message {
      background: #ffebee;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
      color: #c62828;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">❌</div>
    <h1>Ошибка авторизации</h1>
    <div class="error-message">
      ${errorMessage}
    </div>
    <p style="color: #666; font-size: 14px;">
      Проверьте логи сервера для подробностей.
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Create HTML Response
 */
export function createHTMLResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
