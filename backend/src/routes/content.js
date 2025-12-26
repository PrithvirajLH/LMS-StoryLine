import express from 'express';
import path from 'path';
import { authenticate } from '../middleware/auth.js';
import { verifyToken } from '../services/authService.js';
import { streamBlobContent } from '../services/blobService.js';
import { getBlobServiceClient, getContainerName } from '../config/azure.js';
import { getEnrollment, getCourseById, getUserById } from '../services/tableService.js';

const router = express.Router();

// Middleware to authenticate via header or query parameter (for iframes)
async function authenticateContent(req, res, next) {
  try {
    // Try Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
        return next();
      }
    }
    
    // Fallback: try token from query parameter (for iframe requests)
    const tokenParam = req.query.token;
    if (tokenParam) {
      const decoded = verifyToken(tokenParam);
      if (decoded) {
        req.user = decoded;
        return next();
      }
    }
    
    return res.status(401).json({ error: 'No token provided' });
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Serve course content from Blob Storage
// Route: /content/courses/:courseId/xapi/*
router.get('/courses/:courseId/xapi/*', authenticateContent, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.userId;

    // Verify user has access to this course (enrolled or admin)
    const enrollment = await getEnrollment(userId, courseId);
    const user = await getUserById(userId);
    const isAdmin = user?.isAdmin || false;

    if (!enrollment && !isAdmin) {
      return res.status(403).json({ error: 'Access denied. Please enroll in this course first.' });
    }

    // Get course blob path
    const course = await getCourseById(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const blobPath = course.blobPath;

    // Get the file path from the request
    // req.params[0] contains everything after /xapi/
    const filePath = req.params[0] || 'index.html';

    // Prevent directory traversal
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Construct full blob path
    const fullBlobPath = `${blobPath}${filePath}`;

    // For HTML files, we need to rewrite relative URLs to include the token
    // so that scripts, stylesheets, and other resources can load
    if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
      const token = req.query.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);
      
      console.log(`[Content] Serving HTML: ${filePath}, hasToken: ${!!token}`);
      
      if (token) {
        // Read the blob content, rewrite URLs, then send
        const blobServiceClient = getBlobServiceClient();
        const containerName = getContainerName();
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(fullBlobPath);
        
        const downloadResponse = await blobClient.download();
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(chunk);
        }
        
        let htmlContent = Buffer.concat(chunks).toString('utf8');
        
        // Rewrite relative URLs in src, href, and action attributes
        const tokenParam = `token=${encodeURIComponent(token)}`;
        
        // Rewrite script src, link href, img src, etc.
        // Pattern: attribute="relative-url" or attribute='relative-url'
        htmlContent = htmlContent.replace(
          /(src|href|action)\s*=\s*(["'])((?!https?:|\/\/|data:|mailto:|javascript:|#)[^"']+)(["'])/gi,
          (match, attr, quote1, url, quote2) => {
            // Skip if already has query params or is absolute/external URL
            if (url.includes('?') || 
                url.startsWith('http') || 
                url.startsWith('//') || 
                url.startsWith('data:') || 
                url.startsWith('mailto:') || 
                url.startsWith('javascript:') ||
                url.startsWith('#')) {
              return match;
            }
            // Add token to relative URLs
            const separator = url.includes('?') ? '&' : '?';
            const newUrl = `${url}${separator}${tokenParam}`;
            const result = `${attr}=${quote1}${newUrl}${quote2}`;
            return result;
          }
        );
        
        // Inject LRS endpoint configuration and fix image loading
        // Add script to configure TinCan and fix resource loading
        const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const lrsConfigScript = `
<script type="text/javascript">
// Fix image loading - intercept image src assignments and config objects
(function() {
    var tokenParam = '${tokenParam}';
    
    // Intercept Image constructor
    var OriginalImage = window.Image;
    window.Image = function() {
        var img = new OriginalImage();
        var _src = '';
        Object.defineProperty(img, 'src', {
            get: function() { return _src; },
            set: function(value) {
                if (value && !value.includes('?token=') && !value.startsWith('http') && !value.startsWith('//') && !value.startsWith('data:')) {
                    _src = value + (value.includes('?') ? '&' : '?') + tokenParam;
                } else {
                    _src = value;
                }
                if (img.onload) img.onload();
            }
        });
        return img;
    };
    
    // Intercept config objects that might have image paths
    if (typeof Scavenger !== 'undefined' && Scavenger.config && Scavenger.config.Placemarks) {
        for (var i = 0; i < Scavenger.config.Placemarks.length; i++) {
            var icon = Scavenger.config.Placemarks[i].icon;
            if (icon && !icon.includes('?token=') && !icon.startsWith('http') && !icon.startsWith('//')) {
                Scavenger.config.Placemarks[i].icon = icon + (icon.includes('?') ? '&' : '?') + tokenParam;
            }
        }
    }
    
    // Also fix any img elements created via innerHTML or similar
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    var imgs = node.querySelectorAll ? node.querySelectorAll('img') : [];
                    for (var i = 0; i < imgs.length; i++) {
                        var src = imgs[i].src;
                        if (src && !src.includes('?token=') && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:')) {
                            imgs[i].src = src + (src.includes('?') ? '&' : '?') + tokenParam;
                        }
                    }
                }
            });
        });
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();

// Configure LRS endpoint for TinCan
(function() {
    // Wait for TinCan to be available
    var checkTinCan = setInterval(function() {
        if (typeof TinCan !== 'undefined') {
            clearInterval(checkTinCan);
            
            // Find all TinCan instances and configure them
            if (typeof tincan !== 'undefined' && tincan) {
                try {
                    // Add LRS endpoint
                    var lrsEndpoint = '${apiBaseUrl}/xapi';
                    var lrsAuth = btoa('${req.user.email}:token');
                    
                    tincan.addRecordStore({
                        endpoint: lrsEndpoint,
                        auth: 'Basic ' + lrsAuth,
                        allowFail: true  // Allow course to work even if LRS is down
                    });
                    console.log('[LMS] Configured TinCan LRS endpoint:', lrsEndpoint);
                } catch(e) {
                    console.warn('[LMS] Failed to configure LRS:', e);
                }
            }
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(function() {
        clearInterval(checkTinCan);
    }, 5000);
})();
</script>
`;
        
        // Insert the LRS config script before closing </body> or before closing </html>
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', lrsConfigScript + '</body>');
        } else if (htmlContent.includes('</html>')) {
          htmlContent = htmlContent.replace('</html>', lrsConfigScript + '</html>');
        } else {
          // Append at the end if no body/html tags
          htmlContent += lrsConfigScript;
        }
        
        // Fix the getState error handling - wrap the call to handle undefined/null
        // This prevents "Cannot read properties of undefined" errors
        htmlContent = htmlContent.replace(
          /var stateResult = tincan\.getState\("bookmarking-data"\);/g,
          `var stateResult = tincan.getState("bookmarking-data");
            if (!stateResult || typeof stateResult !== 'object' || stateResult === null) {
                stateResult = { err: null, state: null };
            }
            if (typeof stateResult.err === 'undefined') {
                stateResult.err = null;
            }`
        );
        
        // Fix getStatements error handling (for Museum Tour course)
        // Add null check before accessing result.err
        htmlContent = htmlContent.replace(
          /if \(result\.err === null\)/g,
          `if (result && result.err === null)`
        );
        // Also add error handling right after getStatements calls
        htmlContent = htmlContent.replace(
          /(result = tincan\.getStatements\([^)]+\);)/g,
          `$1
            if (!result || typeof result !== 'object') {
                result = { err: null, statementsResult: { statements: [] } };
            }
            if (typeof result.err === 'undefined') {
                result.err = null;
            }`
        );
        
        // Debug: Check what we're rewriting
        const beforeScripts = htmlContent.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
        console.log(`[Content] Found ${beforeScripts.length} script tags before rewrite`);
        
        // Set headers
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Length', Buffer.byteLength(htmlContent));
        res.setHeader('Cache-Control', 'no-cache');
        res.send(htmlContent);
        return;
      }
    }

    // For CSS files, rewrite url() references to include token
    if (filePath.endsWith('.css')) {
      const cssToken = req.query.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);
      
      if (cssToken) {
        // Read the CSS content, rewrite URLs, then send
        const blobServiceClient = getBlobServiceClient();
        const containerName = getContainerName();
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(fullBlobPath);
        
        const downloadResponse = await blobClient.download();
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(chunk);
        }
        
        let cssContent = Buffer.concat(chunks).toString('utf8');
        const cssTokenParam = `token=${encodeURIComponent(cssToken)}`;
        
        // Rewrite url() references in CSS
        cssContent = cssContent.replace(
          /url\((["']?)((?!https?:|\/\/|data:)[^"')]+)(["']?)\)/gi,
          (match, quote1, url, quote2) => {
            // Skip if already has query params or is absolute/external URL
            if (url.includes('?token=') || url.startsWith('http') || url.startsWith('//') || url.startsWith('data:')) {
              return match;
            }
            // Add token to relative URLs
            const separator = url.includes('?') ? '&' : '?';
            const newUrl = `${url}${separator}${cssTokenParam}`;
            return `url(${quote1}${newUrl}${quote2})`;
          }
        );
        
        // Set headers
        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Content-Length', Buffer.byteLength(cssContent));
        res.setHeader('Cache-Control', 'no-cache');
        res.send(cssContent);
        return;
      }
    }

    // For non-HTML/CSS files, stream directly
    await streamBlobContent(fullBlobPath, res);
  } catch (error) {
    if (error.message === 'Blob not found') {
      return res.status(404).json({ error: 'File not found' });
    }
    next(error);
  }
});

export default router;


