import { Elysia, t } from "elysia";
import {
  getAuthUrl,
  fetchAccessToken,
  getAccessToken,
  getTokenStatus,
  resetToken,
  getRefreshToken,
  validateState,
} from "../../utils/getAccessToken";
import { ozonConfig } from "../../config/env";
import {
  generateSuccessHTML,
  generateErrorHTML,
  createHTMLResponse,
} from "../../utils/htmlResponses";

/**
 * Auth module for Ozon OAuth integration
 */
export const auth = new Elysia({ prefix: "/auth" })
  /**
   * Redirect to Ozon OAuth page
   * GET /auth/url
   */
  .get("/url", ({ set }) => {
    try {
      const url = getAuthUrl();
      set.headers['Location'] = url;
      set.status = 302;
      return '';
    } catch (error) {
      set.status = 500;
      return error instanceof Error ? error.message : "Неизвестная ошибка";
    }
  })

  /**
   * OAuth callback endpoint
   * GET /auth/callback?code=AUTHORIZATION_CODE&state=STATE_STRING
   */
  .get(
    "/callback",
    async ({ query }) => {
      const { code, state, error: oauthError, error_description } = query;

      console.log("========================================");
      console.log("📥 OAuth Callback получен:");
      console.log(`   Code: ${code ? "получен" : "отсутствует"}`);
      console.log(`   State: ${state || "отсутствует"}`);
      console.log(`   Error: ${oauthError || "нет"}`);
      console.log(`   Error description: ${error_description || "нет"}`);
      console.log("========================================");

      // Проверяем state для защиты от CSRF атак
      if (!state || !validateState(state)) {
        console.error("❌ Невалидный state - возможна CSRF атака");
        const html = generateErrorHTML(
          "Невалидный state параметр - возможна CSRF атака",
        );
        return createHTMLResponse(html);
      }

      // Check for OAuth errors
      if (oauthError) {
        console.error("❌ OAuth ошибка:", oauthError, error_description);
        return {
          success: false,
          error: oauthError,
          description: error_description || "Ошибка авторизации",
        };
      }

      // Validate code
      if (!code) {
        console.error("❌ Отсутствует параметр code");
        return {
          success: false,
          error: "Отсутствует параметр code",
        };
      }

      try {
        console.log("🔄 Обмен code на токен...");
        // Exchange code for token
        const tokenData = await fetchAccessToken("authorization_code", code);

        console.log("✅ Токен успешно получен");
        console.log(
          `   Expires in: ${tokenData.expires_in - Date.now() / 1000} секунд`,
        );
        console.log(`   Scope: ${tokenData.scope.join(", ")}`);

        // Return HTML response for browser
        const html = generateSuccessHTML({
          expires_in: tokenData.expires_in,
          scope: tokenData.scope,
        });
        return createHTMLResponse(html);
      } catch (error) {
        console.error("❌ Ошибка получения токена:", error);

        // Return HTML error response
        const errorMessage =
          error instanceof Error ? error.message : "Неизвестная ошибка";
        const html = generateErrorHTML(errorMessage);
        return createHTMLResponse(html);
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        state: t.Optional(t.String()),
        error: t.Optional(t.String()),
        error_description: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Get token status (dev only)
   * GET /auth/status
   */
  .get("/status", () => {
    // Available only in dev mode
    if (ozonConfig.isProd) {
      return {
        success: false,
        error: "Endpoint доступен только в dev режиме",
      };
    }

    const status = getTokenStatus();
    const token = getAccessToken();

    return {
      success: true,
      configured: true,
      ...status,
      token_preview: token ? `${token.substring(0, 10)}...` : null,
    };
  })

  /**
   * Reset token (dev only)
   * POST /auth/reset
   */
  .post("/reset", () => {
    // Available only in dev mode
    if (ozonConfig.isProd) {
      return {
        success: false,
        error: "Endpoint доступен только в dev режиме",
      };
    }

    try {
      resetToken();
      return {
        success: true,
        message: "Токен сброшен",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Ошибка сброса токена",
      };
    }
  })

  /**
   * Manual token refresh (dev only)
   * POST /auth/refresh
   */
  .post("/refresh", async () => {
    // Available only in dev mode
    if (ozonConfig.isProd) {
      return {
        success: false,
        error: "Endpoint доступен только в dev режиме",
      };
    }

    const status = getTokenStatus();

    if (!status.hasRefreshToken) {
      return {
        success: false,
        error: "Нет refresh_token. Требуется авторизация.",
      };
    }

    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return {
          success: false,
          error: "Refresh token не найден",
        };
      }

      const tokenData = await fetchAccessToken(
        "refresh_token",
        undefined,
        refreshToken,
      );

      return {
        success: true,
        message: "Токен успешно обновлён",
        token: {
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
          scope: tokenData.scope,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Ошибка обновления токена",
      };
    }
  });
