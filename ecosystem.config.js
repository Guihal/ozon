module.exports = {
  apps: [
    {
      name: "ozon-app",
      script: "src/index.ts",
      interpreter: "bun",
      cwd: "/var/www/ozon/current",
      env: {
        NODE_ENV: "production",
      },
    },
  ],

  deploy: {
    production: {
      user: "root",
      host: "212.57.115.194",
      ref: "origin/main",
      repo: "git@github.com:Guihal/ozon.git",
      path: "/var/www/ozon",

      "post-deploy": `
  export PATH=$HOME/.bun/bin:$PATH &&
  bun install &&
  pm2 reload ecosystem.config.js --env production
`,
    },
  },
};
