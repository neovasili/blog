const _ = require('lodash');
const moment = require('moment');
const cheerio = require('cheerio');
const { formatRfc5646, formatIso639, getClosestRfc5646WithCountryCode, getPageLanguage } = require('../lib/i18n')(hexo);

const MOMENTJS_SUPPORTED_LANGUAGES = ['af', 'ar-dz', 'ar-kw', 'ar-ly', 'ar-ma', 'ar-sa',
    'ar-tn', 'ar', 'az', 'be', 'bg', 'bm', 'bn', 'bo', 'br', 'bs', 'ca', 'cs', 'cv', 'cy',
    'da', 'de-at', 'de-ch', 'de', 'dv', 'el', 'en-au', 'en-ca', 'en-gb', 'en-ie', 'en-il',
    'en-nz', 'eo', 'es-do', 'es-us', 'es', 'et', 'eu', 'fa', 'fi', 'fo', 'fr-ca', 'fr-ch',
    'fr', 'fy', 'gd', 'gl', 'gom-latn', 'gu', 'he', 'hi', 'hr', 'hu', 'hy-am', 'id', 'is',
    'it', 'ja', 'jv', 'ka', 'kk', 'km', 'kn', 'ko', 'ky', 'lb', 'lo', 'lt', 'lv', 'me',
    'mi', 'mk', 'ml', 'mn', 'mr', 'ms-my', 'ms', 'mt', 'my', 'nb', 'ne', 'nl-be', 'nl',
    'nn', 'pa-in', 'pl', 'pt-br', 'pt', 'ro', 'ru', 'sd', 'se', 'si', 'sk', 'sl', 'sq',
    'sr-cyrl', 'sr', 'ss', 'sv', 'sw', 'ta', 'te', 'tet', 'tg', 'th', 'tl-ph', 'tlh', 'tr',
    'tzl', 'tzm-latn', 'tzm', 'ug-cn', 'uk', 'ur', 'uz-latn', 'uz', 'vi', 'x-pseudo', 'yo',
    'zh-cn', 'zh-hk', 'zh-tw'];

function getMomentLocale(language) {
    let locale = formatRfc5646(language);
    if (MOMENTJS_SUPPORTED_LANGUAGES.indexOf(locale) === -1) {
        if (MOMENTJS_SUPPORTED_LANGUAGES.indexOf(formatIso639(locale)) > -1) {
            locale = formatIso639(locale);
        } else if (MOMENTJS_SUPPORTED_LANGUAGES.indexOf(getClosestRfc5646WithCountryCode(locale).toLowerCase()) > -1) {
            locale = getClosestRfc5646WithCountryCode(locale);
        }
    }
    return locale;
}

function injectMomentLocale(func) {
    return function () {
        let language = getMomentLocale(getPageLanguage(this.page));
        moment.locale(language);
        const args = Array.prototype.slice.call(arguments).map(arg => {
            if (arg instanceof moment) {
                return moment(arg).locale(language);
            }
            return arg;
        });
        return func.apply(this, args);
    }
}

hexo.extend.helper.register('is_categories', function () {
    return this.page.__categories;
});

hexo.extend.helper.register('is_tags', function () {
    return this.page.__tags;
});

/**
 * Generate html head title based on page type
 */
hexo.extend.helper.register('page_title', function () {
    const page = this.page;
    let title = page.title;

    if (this.is_archive()) {
        title = this.__('common.archives');
        if (this.is_month()) {
            title += ': ' + page.year + '/' + page.month;
        } else if (this.is_year()) {
            title += ': ' + page.year;
        }
    } else if (this.is_category()) {
        title = this.__('common.category') + ': ' + page.category;
    } else if (this.is_tag()) {
        title = this.__('common.tag') + ': ' + page.tag;
    } else if (this.is_categories()) {
        title = this.__('common.categories');
    } else if (this.is_tags()) {
        title = this.__('common.tags');
    }

    const getConfig = hexo.extend.helper.get('get_config').bind(this);

    return [title, getConfig('title', '', true)].filter(str => typeof (str) !== 'undefined' && str.trim() !== '').join(' - ');
});

/**
 * Format date to string without year.
 */
hexo.extend.helper.register('format_date', injectMomentLocale(function (date) {
    return moment(date).format('MMM D');
}));

/**
 * Format date to string with year.
 */
hexo.extend.helper.register('format_date_full', injectMomentLocale(function (date) {
    return moment(date).format('MMM D YYYY');
}));

/**
 * Get moment.js supported page locale
 */
hexo.extend.helper.register('momentjs_locale', function () {
    return getMomentLocale(getPageLanguage(this.page));
});

/**
 * Export moment.duration
 */
hexo.extend.helper.register('duration', injectMomentLocale(function () {
    return moment.duration.apply(null, arguments);
}));

/**
 * Get the word count of a paragraph.
 */
hexo.extend.helper.register('word_count', (content) => {
    content = content.replace(/<\/?[a-z][^>]*>/gi, '');
    content = content.trim();
    return content ? (content.match(/[\u00ff-\uffff]|[a-zA-Z]+/g) || []).length : 0;
});

hexo.extend.helper.register( 'post_filter_by_lang', ( posts_list, language ) => {
    return posts_list.filter( post => post.lang == language );
} );

/**
 * Export a list of headings of an article
 * [
 *     ['1', 'heading-anchor-1', 'Title of the heading 1', 1],
 *     ['1.1', 'heading-anchor-1-1', 'Title of the heading 1.1', 2],
 * ]
 */
hexo.extend.helper.register('toc_list', (content) => {
    const $ = cheerio.load(content, { decodeEntities: false });
    const levels = [0, 0, 0];
    const levelTags = [];
    // Get top 3 headings
    for (let i = 1; i <= 6; i++) {
        if ($('h' + i).length > 0) {
            levelTags.push('h' + i);
        }
        if (levelTags.length === 3) {
            break;
        }
    }
    const tocList = [];
    if (levelTags.length === 0) {
        return tocList;
    }
    const headings = $(levelTags.join(','));
    headings.each(function () {
        const level = levelTags.indexOf(this.name);
        const id = $(this).attr('id');
        const text = _.escape($(this).text());

        for (let i = 0; i < levels.length; i++) {
            if (i > level) {
                levels[i] = 0;
            } else if (i < level) {
                // if headings start with a lower level heading, set the former heading index to 1
                // e.g. h3, h2, h1, h2, h3 => 1.1.1, 1.2, 2, 2.1, 2.1.1
                if (levels[i] === 0) {
                    levels[i] = 1;
                }
            } else {
                levels[i] += 1;
            }
        }
        tocList.push([levels.slice(0, level + 1).join('.'), id, text, level + 1]);
    });
    return tocList;
});

function patchCodeHighlight(content) {
    const $ = cheerio.load(content, { decodeEntities: false });
    $('figure.highlight').addClass('hljs');
    $('figure.highlight .code .line span').each(function () {
        const classes = $(this).attr('class').split(' ');
        if (classes.length === 1) {
            $(this).addClass('hljs-' + classes[0]);
            $(this).removeClass(classes[0]);
        }
    });
    return $.html();
}

/**
 * Add .hljs class name to the code blocks and code elements
 */
hexo.extend.filter.register('after_post_render', function (data) {
    data.content = data.content ? patchCodeHighlight(data.content) : data.content;
    data.excerpt = data.excerpt ? patchCodeHighlight(data.excerpt) : data.excerpt;
    return data;
});

hexo.extend.helper.register( 'power_list_archives', function (options = {}) {
    const { config } = this;
    const archiveDir = config.archive_dir;
    const { timezone } = config;
    const lang = this.page.lang || this.page.language || config.language;
    let { format } = options;
    const type = options.type || 'monthly';
    const { style = 'list', transform, separator = ', ' } = options;
    const showCount = options.hasOwnProperty('show_count') ? options.show_count : true;
    const className = options.class || 'archive';
    const order = options.order || -1;
    let result = '';
  
    if (!format) {
      format = type === 'monthly' ? 'MMMM YYYY' : 'YYYY';
    }
  
    const posts = this.site.posts.sort('date', order).filter( post => post.lang == lang );
    if (!posts.length) return result;
  
    const data = [];
    let length = 0;
  
    posts.forEach(post => {
      // Clone the date object to avoid pollution
      let date = post.date.clone();
  
      if (timezone) date = date.tz(timezone);
      if (lang) date = date.locale(lang);
  
      const year = date.year();
      const month = date.month() + 1;
      const name = date.format(format);
      const lastData = data[length - 1];
  
      if (!lastData || lastData.name !== name) {
        length = data.push({
          name,
          year,
          month,
          count: 1
        });
      } else {
        lastData.count++;
      }
    });
  
    const link = item => {
      let url = `${archiveDir}/${item.year}/`;
  
      if (type === 'monthly') {
        if (item.month < 10) url += '0';
        url += `${item.month}/`;
      }
  
      return this.url_for(url);
    };
  
    if (style === 'list') {
      result += `<ul class="${className}-list">`;
  
      for (let i = 0, len = data.length; i < len; i++) {
        const item = data[i];
  
        result += `<li class="${className}-list-item">`;
  
        result += `<a class="${className}-list-link" href="${link(item)}">`;
        result += transform ? transform(item.name) : item.name;
        result += '</a>';
  
        if (showCount) {
          result += `<span class="${className}-list-count">${item.count}</span>`;
        }
  
        result += '</li>';
      }
  
      result += '</ul>';
    } else {
      for (let i = 0, len = data.length; i < len; i++) {
        const item = data[i];
  
        if (i) result += separator;
  
        result += `<a class="${className}-link" href="${link(item)}">`;
        result += transform ? transform(item.name) : item.name;
  
        if (showCount) {
          result += `<span class="${className}-count">${item.count}</span>`;
        }
  
        result += '</a>';
      }
    }
  
    return result;
  });

hexo.extend.helper.register( 'power_list_categories', function (categories, options) {
    if (!options && (!categories || !categories.hasOwnProperty('length'))) {
      options = categories;
      categories = this.site.categories;
    }
  
    if (!categories || !categories.length) return '';
    options = options || {};
  
    const { style = 'list', transform, separator = ', ', suffix = '' } = options;
    const showCount = options.hasOwnProperty('show_count') ? options.show_count : true;
    const className = options.class || 'category';
    const lang = this.page.lang || this.page.language || config.language;
    const depth = options.depth ? parseInt(options.depth, 10) : 0;
    const orderby = options.orderby || 'name';
    const order = options.order || 1;
    const showCurrent = options.show_current || false;
    const childrenIndicator = options.hasOwnProperty('children_indicator') ? options.children_indicator : false;
  
    const prepareQuery = parent => {
      const query = {};
  
      if (parent) {
        query.parent = parent;
      } else {
        query.parent = {$exists: false};
      }
  
      return categories.find(query).sort(orderby, order).filter(cat => cat.length);
    };
  
    const hierarchicalList = (level, parent) => {
      let result = '';
  
      prepareQuery(parent).forEach((cat, i) => {
        let child;
        let posts_list = cat.posts.filter( post => post.lang == lang );
        let posts_list_size = posts_list.length;

        if (!depth || level + 1 < depth) {
          child = hierarchicalList(level + 1, cat._id);
        }
  
        let isCurrent = false;
        if (showCurrent && this.page) {
          for (let j = 0; j < posts_list_size; j++) {
            const post = posts_list.data[j];
                if (post && post._id === this.page._id) {
                    isCurrent = true;
                    break;
                }
          }
  
          // special case: category page
          isCurrent = isCurrent || (this.page.base && this.page.base.startsWith(cat.path));
        }
  
        const additionalClassName = child && childrenIndicator ? ` ${childrenIndicator}` : '';
  
        result += `<li class="${className}-list-item${additionalClassName}">`;
  
        result += `<a class="${className}-list-link${isCurrent ? ' current' : ''}" href="${this.url_for(cat.path)}${suffix}">`;
        result += transform ? transform(cat.name) : cat.name;
        result += '</a>';
  
        if (showCount) {
          result += `<span class="${className}-list-count">${posts_list_size}</span>`;
        }
  
        if (child) {
          result += `<ul class="${className}-list-child">${child}</ul>`;
        }
  
        result += '</li>';
      });
  
      return result;
    };
  
    const flatList = (level, parent) => {
      let result = '';
  
      prepareQuery(parent).forEach((cat, i) => {
        let posts_list = cat.posts.filter( post => post.lang == lang );
        let posts_list_size = posts_list.length;

        if (i || level) result += separator;
  
        result += `<a class="${className}-link" href="${this.url_for(cat.path)}${suffix}">`;
        result += transform ? transform(cat.name) : cat.name;
  
        if (showCount) {
          result += `<span class="${className}-count">${posts_list_size}</span>`;
        }
  
        result += '</a>';
  
        if (!depth || level + 1 < depth) {
          result += flatList(level + 1, cat._id);
        }
      });
  
      return result;
    };
  
    if (style === 'list') {
      return `<ul class="${className}-list">${hierarchicalList(0)}</ul>`;
    }
  
    return flatList(0);
});

hexo.extend.helper.register( 'power_list_tags', function( tags, options ) {
    
  
  if (!options && (!tags || !tags.hasOwnProperty('length'))) {
    options = tags;
    tags = this.site.tags;
  }
  
  if (!tags || !tags.length) return '';
  options = options || {};
  
    const { style = 'list', transform, separator = ', ', suffix = '' } = options;
    const showCount = options.hasOwnProperty('show_count') ? options.show_count : true;
    const className = options.class || 'tag';
    const lang = this.page.lang || this.page.language || config.language;
    const orderby = options.orderby || 'name';
    const order = options.order || 1;
    let result = '';
  
    // Ignore tags with zero posts
    tags = tags.filter( tag => tag.length );

    // Sort the tags
    tags = tags.sort( orderby, order );
  
    // Limit the number of tags
    if (options.amount) tags = tags.limit(options.amount);
  
    if (style === 'list') {
      result += `<ul class="${className}-list">`;
  
      tags.forEach( tag => {
        let tag_posts_lists = tag.posts.filter( post => post.lang == lang );
        let tag_posts_size = tag_posts_lists.length;

        result += `<li class="${className}-list-item">`;
  
        result += `<a class="${className}-list-link" href="${this.url_for(tag.path)}${suffix}">`;
        result += transform ? transform(tag.name) : tag.name;
        result += '</a>';
  
        if (showCount) {
          result += `<span class="${className}-list-count">${tag_posts_size}</span>`;
        }
  
        result += '</li>';
      });
  
      result += '</ul>';
    } else {
      tags.forEach((tag, i) => {
        let tag_posts_lists = tag.posts.filter( post => post.lang == lang );
        let tag_posts_size = tag_posts_lists.length;

        if (i) result += separator;
  
        result += `<a class="${className}-link" href="${this.url_for(tag.path)}${suffix}">`;
        result += transform ? transform(tag.name) : tag.name;
  
        if (showCount) {
          result += `<span class="${className}-count">${tag_posts_size}</span>`;
        }
  
        result += '</a>';
      });
    }
  
    return result;
});