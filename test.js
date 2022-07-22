const vs = require('./src/index');

const TIMCAST_USERNAME = process.env.TIMCAST_USERNAME;
const TIMCAST_PASSWORD = process.env.TIMCAST_PASSWORD;

// Each channel is it's own directory, but videos are in a common
// location. Thus we will crawl each directory to uncover video links
// then crawl the video links to enumerate video tags.
const channels = [
  {
    name: 'Timcast IRL',
    url: 'https://timcast.com/members-area/section/timcast-irl/',
    options: {
      headless: true,
      depth: null,
      limit: 20,
      whitelist: [
        /^https:\/\/timcast.com\/members-area\/section\/timcast-irl\//,
        /^https:\/\/timcast.com\/members-area\/.*member-podcast/,
      ],
      login: {
        url: 'https://timcast.com/login/',
        username: ['#user_login', TIMCAST_USERNAME],
        password: ['#user_pass', TIMCAST_PASSWORD],
        submit: '#wp-submit',
      },
    },
  },
  // {
  //   name: 'Timcast IRL',
  //   url: 'https://timcast.com/members-area/section/green-room/',
  //   options: {
  //     headless: true,
  //     depth: null,
  //     limit: 20,
  //     whitelist: [
  //       /^https:\/\/timcast.com\/members-area\/section\/green-room\//,
  //       /^https:\/\/timcast.com\/members-area\/.*green-room/,
  //     ],
  //     login: {
  //       url: 'https://timcast.com/login/',
  //       username: ['#user_login', TIMCAST_USERNAME],
  //       password: ['#user_pass', TIMCAST_PASSWORD],
  //       submit: '#wp-submit',
  //     },
  //   },
  // },
];

debugger;
(async () => {
  for (const channel of channels) {
    videos = await vs.scrape(channel.url, channel.options);
    console.log('Got:', videos.length, 'videos for channel:', channel.name);
    console.log(videos);
  }
})();
