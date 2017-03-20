function safeTitle(fn) {
  var match = fn
    .toString()
    .replace(/\n/g, ' ')
    .match(/\/\*(.+)\*\//)

  return match ? match[1] : ''
}

function FollowingBlogsDataModule() {
  // {block:Following}
  return [
    // {block:Followed}
    {
      avatar: '{FollowedPortraitURL-16}',
      title: safeTitle(function(){/*{FollowedTitle}*/}),
      name: '{FollowedName}',
      url: '{FollowedURL}'
    },
    // {block:Followed}
  ]
  // {/block:Following}
  return []
}

function FollowingBlogsModule() {
  var followingData = FollowingBlogsDataModule()
  var sortedFollowingData = followingData.sort(function(p, n) {
    var a = (p.title[0] || '').toUpperCase()
    var b = (n.title[0] || '').toUpperCase()
    return a > b ? 1 : (b > a ? -1 : 0)
  })
  return ''                                               +
    '<h3>Blogs I follow:</h3>'                            +
    '<ol class="following">'                              +
      sortedFollowingData.map(function(fw) {
        return ''                                         +
          '<li>'                                          +
            '<a href="' + fw.url  + '" target="_blank">'  +
              '<img src="' + fw.avatar + '" '             +
                   'alt="' + fw.name + '" />'             +
            '</a> '                                       +
            '<a href="' + fw.url  + '" target="_blank">'  +
              fw.title                                    +
            '</a>'                                        +
          '</li>'
      }).join('')                                         +
    '</ol>'
}

function RouterModule() {
  return Backbone.Router.extend({
    initialize: function (options) {
      this.renderRule = options.renderRule
      this.onRoute = options.onRoute
    },

    routes: {
      '': 'home',
      'about-me': 'aboutMe',
      'tagged/*path': 'tagged',
      'search/*path': 'search',
      'post/*path': 'post',
      'page/:number': 'page',
      'ask': 'ask',
      '*notfound': 'notFound'
    },

    _onRoute: function(route) {
      if (this.renderRule(route)) {
        fetch(route)
          .then(function(result) { return result.text() })
          .then(function(text) {
            if (typeof this.onRoute === 'function') {
              this.onRoute(text, route)
            }
          }.bind(this))
      }
    },

    notFound: function(route) {
      this._onRoute(route)
    },

    home: function() {
      this._onRoute('/')
    },

    aboutMe: function() {
      this._onRoute('/about-me')
    },

    tagged: function(path) {
      this._onRoute('/tagged/' + path)
    },

    search: function(path) {
      this._onRoute('/search/' + (path || ''))
    },

    post: function(path) {
      this._onRoute('/post/' + path)
    },

    page: function(pageNumber) {
      this._onRoute('/page/' + pageNumber)
    },

    ask: function() {
      this._onRoute('/ask')
    }
  })
}

var Utils = {
  DOMFragmentFromText: function(text) {
    var fragment = document.createDocumentFragment()
    var container = document.createElement('div')
    container.insertAdjacentHTML('beforeend', text)
    fragment.appendChild(container)
    return fragment.children[0]
  },

  hide: function(element) {
    element.style.cssText = 'transition: none; opacity: 0;'
  },

  fadeIn: function(element) {
    element.classList.add('fade-in')
    setTimeout(function() {
      element.classList.remove('fade-in')
    }, 300)
  },

  getTumblrIframe() {
    return (
      document.getElementsByName('desktop-logged-in-controls')[0] ||
      document.getElementsByClassName('tmblr-iframe')[0] ||
      document.querySelector('iframe[src*="dashboard/iframe"]')
    )
  },

  getPostID() {
    return document.getElementById('post-id').value
  }
}

var App = {
  CONTENT: '.main-contents',
  ABOUT_ME_CONTENT: '.main-contents .main-article',
  TOP_PAGINATION: '.main-pagination--top',
  BOTTOM_PAGINATION: '.main-pagination--bottom',
  PAGINATION_LINKS: '.main-pagination a',
  BOTTOM_PAGINATION_LINKS: '.main-pagination--bottom a',
  NAVIGATION_LINKS: '.main-navigation a',
  TITLE: '.main-title a',
  POST_TITLE: '.main-article:not(.main-article--permalink) .permalink, .read_more',
  DISCUSS_SCRIPT_ID: 'disqus_embed',

  skippedFirstRender: false,

  bindLinksToRouter: function(nodes) {
    ;[].slice.call(nodes).forEach(function(node) {
      node.addEventListener('click', function(event) {
        if (!event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey && event.which !== 2) {
          event.preventDefault()
          var origin = document.location.origin
          var route = node.href.replace(origin + '/', '')
          this.router.navigate(route, { trigger: true })
        }
      }.bind(this))
    }.bind(this))
  },

  onSearch: function(event) {
    var value = event.which || event.keyCode
    var notChanged = (
        value === 36 || value === 37 || value === 38 || value === 39 ||
        value === 16 || value === 27 || value === 20 ||
        event.ctrlKey || event.shiftKey || event.metaKey
    )
    if (!notChanged) {
      this.router.navigate('search/' + event.target.value, { trigger: true })
    }
  },

  onRoute: function(result, route) {
    var fragment = Utils.DOMFragmentFromText(result)

    // Get content section
    var contents = document.querySelector(this.CONTENT)
    // Refresh content section
    Utils.hide(contents)
    contents.outerHTML = fragment.querySelector(this.CONTENT).outerHTML
    Utils.fadeIn(document.querySelector(this.CONTENT))
    this.bindLinksToRouter(document.querySelectorAll(this.POST_TITLE))

    // Get pagination sections
    var topPagination = document.querySelector(this.TOP_PAGINATION)
    var bottomPagination = document.querySelector(this.BOTTOM_PAGINATION)
    // Refresh pagination sections
    topPagination.outerHTML = fragment.querySelector(this.TOP_PAGINATION).outerHTML
    bottomPagination.outerHTML = fragment.querySelector(this.BOTTOM_PAGINATION).outerHTML
    this.bindLinksToRouter(document.querySelectorAll(this.PAGINATION_LINKS))
    this.bindBottomPaginationLinksClickHandlers()

    // Reset search input's value if it's not search route any more
    if (!/^\/search/.test(route)) {
      document.getElementById('q').value = ''
    }

    // Perform some dynamic rendering if it's /about-me
    if (/^\/about-me$/.test(route)) {
      this.renderAboutMePage()
    }

    // Update page title
    document.title = fragment.querySelector('title').innerText

    // Disqus
    if (/^\/post\//.test(route)) {
      this.renderDisqus(route)
    }

    // Handle tumblr iframe
    var tumblrIframe = Utils.getTumblrIframe()
    if (!tumblrIframe) {
      console.info('no iframe')

    } else {
      var iframeSrc = decodeURIComponent(tumblrIframe.src)
      var iframeSrcRoot = iframeSrc.split('?')[0]
      var iframeSrcQuery = iframeSrc.split('?')[1]
      var iframeQueryParts = iframeSrcQuery.split('&')
      var newSrc = [iframeSrcRoot, iframeQueryParts.map(function(part) {
        var pid = ''
        if (/src=/.test(part)) {
          if (/post/.test(route)) {
            pid = 'pid=' + Utils.getPostID()
          }
          return pid + '&' + 'src=' + encodeURIComponent(document.location.origin + route)
        }
        if (/pid=/.test(part) && !/^\/post/.test(route)) {
          return ''
        }
        return part
      }).join('&')].join('?')

      if (tumblrIframe.src !== newSrc) {
        tumblrIframe.contentWindow.location.replace(newSrc)
      }

      tumblrIframe.title = 'Tumblr controls'
    }
  },

  renderAboutMePage() {
    var aboutMeContent = document.querySelector(this.ABOUT_ME_CONTENT)
    var followingBlogs = FollowingBlogsModule()
    aboutMeContent.insertAdjacentHTML('beforeend', followingBlogs)
  },

  renderDisqus(route) {
    var previousEmbed = document.getElementById(this.DISCUSS_SCRIPT_ID)
    if (previousEmbed) {
      DISQUS.reset({
        reload: true,
        config: function () {
          this.page.identifier = route.match(/\/post\/(.+)\//)[1]
          this.page.url = document.location.href
          this.page.title = document.title
        }
      })

    } else {
      var dsq = document.createElement('script')
      var disqus_shortname = '{text:Disqus Shortname}'
      dsq.type = 'text/javascript'
      dsq.async = true
      dsq.id = this.DISCUSS_SCRIPT_ID
      dsq.src = '//' + disqus_shortname + '.disqus.com/embed.js'
      var target = (
        document.getElementsByTagName('head')[0] ||
        document.getElementsByTagName('body')[0]
      )
      target.appendChild(dsq)
    }
  },

  bindBottomPaginationLinksClickHandlers() {
    ;[].slice.call(document.querySelectorAll(this.BOTTOM_PAGINATION_LINKS))
      .forEach(function(el) {
        el.addEventListener('click', function() {
          document.location.hash = 'top'
        })
      })
  },

  init: function() {
    if (!window.history || !window.fetch) {
      return
    }

    var Router = RouterModule()

    this.router = new Router({

      // Predicate fn to decide if router should work
      renderRule: function (route) {
        if (this.skippedFirstRender) {
          // This isn't the first opening; run router
          return true

        } else {

          // First time page opening in about-me
          if (/^\/about-me$/.test(route)) {
            this.renderAboutMePage()
          }

          // First time page opening in post
          if (/^\/post\//.test(route)) {
            this.renderDisqus(route)
          }

          // Detect the replacement of Tumblr iframe, and when it becomes stable do stuff
          var intervalLimit = 15
          var tumblrIframe = Utils.getTumblrIframe()

          var interval = setInterval(function() {
            var newTumblrIframe = Utils.getTumblrIframe()
            /*
             * Tumblr iframe is replaced with another in the first render,
             * after some unknown time, at least for the time of this implementation.
             *
             * So check if it becomes different than the first one, periodically, and
             * do any operations then.
             *
             * If the iframe stays the same in the future, this code
             * will still do the operations with the last found iframe.
             */
            if (tumblrIframe !== newTumblrIframe || intervalLimit-- < 0) {
              clearInterval(interval)

              // Iframe is ready
              requestAnimationFrame(function() {
                newTumblrIframe.title = 'Tumblr controls'
              })
            }
          }, 500)

          // Will continue with router after the first render logic above
          this.skippedFirstRender = true

          // Don't run router for this time
          return false
        }

      }.bind(this),

      onRoute: this.onRoute.bind(this)
    })

    this.router.on('route', function(route) {
      console.log('routing:', route)
    })

    Backbone.history.start({ pushState: true })

    this.bindLinksToRouter(document.querySelectorAll(this.TITLE))
    this.bindLinksToRouter(document.querySelectorAll(this.POST_TITLE))
    this.bindLinksToRouter(document.querySelectorAll(this.NAVIGATION_LINKS))
    this.bindLinksToRouter(document.querySelectorAll(this.PAGINATION_LINKS))
    this.bindBottomPaginationLinksClickHandlers()

    var searchForm = document.getElementById('search')
    var searchInput = document.getElementById('q')
    var debouncedSearch = _.debounce(this.onSearch.bind(this), 300)
    searchInput.addEventListener('keydown', debouncedSearch)
    searchForm.addEventListener('submit', function(event) { event.preventDefault() })
  }
}

window.addEventListener('DOMContentLoaded', App.init.bind(App))
