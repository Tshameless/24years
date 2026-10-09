module.exports = {
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
  rules: {
    'alpha-value-notation': 'percentage',
    'color-function-notation': 'modern',
    'selector-class-pattern': null,
    'rule-empty-line-before': ['always', { except: ['first-nested'] }],
    'at-rule-empty-line-before': ['always', { except: ['first-nested'] }],
  },
};
