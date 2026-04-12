module.exports = {
  apps: [{
    name: 'radler-backend',
    script: 'src/server.js',
    env: {
      NODE_ENV: 'production',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
  }]
};
