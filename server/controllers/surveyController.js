const User = require('../models/User');
const { publicUser } = require('../services/authSession');

const allowedStyles = ['Minimalist', 'Streetwear', 'Vintage', 'Y2K', 'Formal', 'Casual', 'Preppy'];
const allowedActivities = ['University', 'Presentation', 'Date', 'Internship / work', 'Casual outings', 'Formal events'];

async function getSurvey(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  res.json({
    survey: {
      preferredStyles: user.preferredStyles || [],
      activities: user.activities || [],
      budget: user.budget || 40,
      completed: user.surveyCompleted === true,
    },
  });
}

async function saveSurvey(req, res) {
  if (req.user.role !== 'consumer') {
    return res.status(403).json({ message: 'Style preferences are only available for customer accounts.' });
  }

  const preferredStyles = Array.isArray(req.body?.preferredStyles) ? req.body.preferredStyles : [];
  const activities = Array.isArray(req.body?.activities) ? req.body.activities : [];
  const budget = Number(req.body?.budget);

  if (preferredStyles.length < 1 || preferredStyles.length > 2 || preferredStyles.some(style => !allowedStyles.includes(style))) {
    return res.status(400).json({ message: 'Choose 1 or 2 valid style preferences.' });
  }
  if (activities.length < 1 || activities.some(activity => !allowedActivities.includes(activity))) {
    return res.status(400).json({ message: 'Choose at least one valid occasion.' });
  }
  if (!Number.isFinite(budget) || budget < 10 || budget > 100) {
    return res.status(400).json({ message: 'Choose a budget between S$10 and S$100.' });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      preferredStyles: [...new Set(preferredStyles)],
      activities: [...new Set(activities)],
      budget: Math.round(budget),
      surveyCompleted: true,
    },
    { new: true, runValidators: true }
  );

  if (!user) return res.status(404).json({ message: 'Account not found.' });
  res.json({ user: publicUser(user) });
}

module.exports = { getSurvey, saveSurvey };
