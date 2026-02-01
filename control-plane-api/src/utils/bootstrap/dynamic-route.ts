// import type { Router } from 'express';
// import fs from 'fs';
// import path from 'path';

// import logger from '../../config/logger';

// const isRouteFile = (file: string) => /\.route\.(ts|js)$/i.test(file);

// const registerRoutes = (router: Router): void => {
//   const routesDir = path.join(__dirname, '../../routes');

//   const walkDir = (dir: string) => {
//     const entries = fs.readdirSync(dir, { withFileTypes: true });

//     entries.forEach((entry) => {
//       const fullPath = path.join(dir, entry.name);

//       if (entry.isDirectory()) {
//         walkDir(fullPath); // recursion for nested folders like v1/
//       } else if (entry.isFile() && isRouteFile(entry.name)) {
//         logger.info(`    ${path.relative(routesDir, fullPath)}`);

//         const routeModule = require(fullPath);
//         const register = routeModule.default || routeModule;

//         if (typeof register === 'function') {
//           register(router); // inject into main router
//         }
//       }
//     });
//   };

//   walkDir(routesDir);

//   // Log registered routes
//   const routes: string[] = [];

//   (router.stack as any[]).forEach((layer) => {
//     if (layer.route?.path && layer.route?.methods) {
//       const methods = Object.keys(layer.route.methods)
//         .filter((m) => layer.route.methods[m])
//         .map((m) => m.toUpperCase());
//       methods.forEach((method) => {
//         routes.push(`${method} ${layer.route.path}`);
//       });
//     }
//   });

//   if (routes.length > 0) {
//     logger.info('Registered API routes:');
//     routes.forEach((route) => logger.info(`  → ${route}`));
//   } else {
//     logger.warn('No API routes registered.');
//   }
// };

// export default registerRoutes;
