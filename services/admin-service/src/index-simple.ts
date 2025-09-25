import app from './app-simple';

const PORT = process.env.PORT || 3005;

async function startServer() {
  try {
    console.log('Starting Simple Admin Service...');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Version: 1.0.0-simple`);
    
    const server = app.listen(PORT, () => {
      console.log(`✅ Simple Admin Service running on port ${PORT}`);
      console.log(`📚 Available endpoints:`);
      console.log(`   GET /admin/users - List all users`);
      console.log(`   GET /admin/system/stats - System statistics`);
      console.log(`   GET /admin/system/health - System health check`);
      console.log(`   GET /admin/activity-logs - Activity logs`);
      console.log(`   GET /admin/health - Basic health check`);
      console.log(`   GET /admin/info - Service information`);
      console.log('');
      console.log(`🔗 Test with: curl http://localhost:${PORT}/admin/info`);
    });

    // Handle graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      server.close((err) => {
        if (err) {
          console.error('❌ Error during server close:', err);
          process.exit(1);
        }
        
        console.log('✅ Simple Admin Service shut down successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start Simple Admin Service:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer().catch(error => {
    console.error('❌ Startup error:', error);
    process.exit(1);
  });
}

export default startServer;