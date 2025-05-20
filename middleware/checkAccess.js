// middleware/checkAccess.js

const checkAccess = async function checkAccess(req, res, next) {
    const user = req.user; // предполагается, что req.user установлен заранее через auth middleware
  
    const now = new Date();
  
    if (user.isPremium || now < user.premiumEndsAt) {
      return next(); // доступ разрешён
    }
  
    return res.status(403).json({
      message: "Ваш пробный период истёк. Пожалуйста, приобретите премиум-доступ."
    });
};

module.exports = { checkAccess }