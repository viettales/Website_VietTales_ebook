(() => {
const $=id=>document.getElementById(id);
let db=null,user=null,admin=false,mode='login',stories=[],imagePath=null,audioPath=null,videoPath=null,favorites=[];
let audioFile=null;
let videoFile=null;
  if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
  db = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
}
let storyHtml='',storyTextSnapshot='';
const routes={
  'Truyền Thuyết':'truyen-thuyet',
  'Truyện Cười':'truyen-cuoi',
  'Truyện Cổ Tích':'truyen-co-tich',
  'Truyện Giải Thích Địa Phương':'truyen-dia-phuong',
  'Truyện Ngụ Ngôn':'truyen-ngu-ngon'
};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s,error=false){let t=$('toast');t.textContent=s;t.className='show'+(error?' error':'');setTimeout(()=>t.className='',3500)}

function page(key){
  document.querySelectorAll('.page').forEach(
    p=>p.classList.toggle('active',p.dataset.section===key)
  );

  document.querySelectorAll('nav a').forEach(
    a=>a.classList.toggle('active',a.dataset.page===key)
  );

  $('nav').classList.remove('open');
  scrollTo({top:0,behavior:'smooth'});

  if(key==='ban-do-so'){
    initFolkMap();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if(folkMap){
          folkMap.invalidateSize({pan:false});

          if(!$('map-region')?.value){
            showWholeVietnam();
          }
        }
      });
    });
  }
}



/* ===== BAN DO SO VIETALES ===== */
let folkMap = null;
let folkMarkers = [];
let folkIslandMarkers = [];

let vietnamBoundaryLayer = null;
let folkRegionMarkersLayer = null;
let vietnamBoundaryLoading = false;
function removeVietnamBoundaries() {
  if (folkMap && vietnamBoundaryLayer) {
    folkMap.removeLayer(vietnamBoundaryLayer);
  }

  vietnamBoundaryLayer = null;
  vietnamBoundaryLoading = false;
}
function renderHistoricalRegionMarkers() {
  if (!folkMap || folkRegionMarkersLayer) return;

  folkRegionMarkersLayer = L.layerGroup().addTo(folkMap);
  const places = [
    {
      key: 'tra-vinh',
      name: 'Trà Vinh trước đây',
      position: [9.93, 106.34],
      color: '#813c33'
    },
    {
      key: 'ben-tre',
      name: 'Bến Tre trước đây',
      position: [10.24, 106.38],
      color: '#a87531'
    },
    {
      key: 'vinh-long',
      name: 'Vĩnh Long trước đây',
      position: [10.25, 105.97],
      color: '#526047'
    }
  ];

  places.forEach(function (place) {
    const marker = L.circleMarker(place.position, {
      radius: 8,
      color: '#fffdf8',
      weight: 2,
      fillColor: place.color,
      fillOpacity: 1
    });

    marker.bindTooltip(place.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -7]
    });

    marker.bindPopup(
      '<strong>' + place.name + '</strong><br>' +
      'Khu vực văn hóa được ghi nhận theo địa danh lịch sử.'
    );

    marker.on('click', function () {
      const selector = document.getElementById('map-region');

      if (selector) {
        selector.value = place.key;
        filterFolkMap();
      }

      folkMap.setView(place.position, 9);
    });

    folkRegionMarkersLayer.addLayer(marker);
  });
}


const VIETNAM_BOUNDS = [
  [7.5, 101.5],
  [24, 115]
];

function showWholeVietnam() {
  if (!folkMap) return;

  folkMap.fitBounds(VIETNAM_BOUNDS, {
    padding: [20, 20],
    maxZoom: 6,
    animate: false
  });
}

const folkRegions = {
  'tra-vinh': {
    name: 'Trà Vinh trước đây',
    center: [9.93, 106.34],
    bounds: [9.4, 10.3, 105.7, 106.9]
  },
  'ben-tre': {
    name: 'Bến Tre trước đây',
    center: [10.24, 106.38],
    bounds: [9.7, 10.7, 105.7, 107.0]
  },
  'vinh-long': {
    name: 'Vĩnh Long trước đây',
    center: [10.25, 105.97],
    bounds: [9.7, 10.8, 105.4, 106.6]
  }
};

function getIllustrativePoint(story) {
  const region = folkRegions[story.region];

  if (!region) return null;

  // Tạo vị trí ổn định từ mã truyện, không đổi khi tải lại.
  const key = String(story.id || story.title);
  let hash = 0;

  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  const latOffset = ((hash % 10000) / 10000 - 0.5) * 0.24;
  const lngOffset =
    (((Math.floor(hash / 10000)) % 10000) / 10000 - 0.5) * 0.30;

  return [
    region.center[0] + latOffset,
    region.center[1] + lngOffset
  ];
}

function getStoryMapPoint(story) {
  if (!story.is_published || !story.region) return null;
  if (!folkRegions[story.region]) return null;

  if (story.map_mode === 'real') {
    if (
      story.latitude === null ||
      story.latitude === undefined ||
      story.latitude === '' ||
      story.longitude === null ||
      story.longitude === undefined ||
      story.longitude === ''
    ) return null;

    const lat = Number(story.latitude);
    const lng = Number(story.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    const [minLat, maxLat, minLng, maxLng] =
      folkRegions[story.region].bounds;

    // Không hiển thị điểm nằm ngoài phạm vi tham khảo của khu vực.
    if (
      lat < minLat || lat > maxLat ||
      lng < minLng || lng > maxLng
    ) return null;

    return { lat, lng, illustrative: false };
  }

  if (story.map_mode === 'illustrative') {
    const point = getIllustrativePoint(story);

    if (!point) return null;

    return {
      lat: point[0],
      lng: point[1],
      illustrative: true
    };
  }

  return null;
}


function initFolkMap() {
  const el = $('folk-map');

  if (!el || !window.L) {
    console.error('Không tìm thấy vùng bản đồ hoặc thư viện Leaflet.');
    return;
  }

  if (!folkMap) {
    folkMap = L.map(el);

  L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4udb_1_6d5e613e93cae3b825d0c334',
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }
).addTo(folkMap);.addTo(folkMap);

    removeVietnamBoundaries();
    renderHistoricalRegionMarkers();

    const islands = [
      {
        name: 'Quần đảo Hoàng Sa',
        position: [16.5, 112.0]
      },
      {
        name: 'Quần đảo Trường Sa',
        position: [8.6, 111.9]
      }
    ];

    islands.forEach(island => {
      const marker = L.circleMarker(island.position, {
        radius: 6,
        color: '#8b3f27',
        weight: 2,
        fillColor: '#d9a441',
        fillOpacity: 1
      }).addTo(folkMap);

      marker.bindTooltip(island.name, {
        permanent: true,
        direction: 'right',
        offset: [8, 0],
        className: 'folk-island-label'
      });

      folkIslandMarkers.push(marker);
    });

    const filter = $('map-region');

    if (filter) {
      filter.addEventListener('change', filterFolkMap);
    }

    $('map-zoom-in')?.addEventListener('click', () => {
      folkMap.zoomIn();
    });

    $('map-zoom-out')?.addEventListener('click', () => {
      folkMap.zoomOut();
    });

    $('map-show-all')?.addEventListener('click', () => {
      if (filter) filter.value = '';
      renderFolkMapMarkers();
      showWholeVietnam();
    });

    $('map-reset')?.addEventListener('click', () => {
      if (filter) filter.value = '';
      renderFolkMapMarkers();
      showWholeVietnam();
    });
  }

  renderFolkMapMarkers();

  requestAnimationFrame(() => {
    if (folkMap) {
      folkMap.invalidateSize();

      if (!$('map-region')?.value) {
        showWholeVietnam();
      }
    }
  });
}

function renderFolkMapMarkers() {
  if (!folkMap) return;

  folkMarkers.forEach(marker => marker.remove());
  folkMarkers = [];

  const region = $('map-region')?.value || '';
  const details = $('map-story-details');

  let invalidRealCount = 0;
  let visibleCount = 0;

  stories.forEach(story => {
    if (!story.is_published) return;
    if (region && story.region !== region) return;
    if (story.map_mode === 'none') return;

    const point = getStoryMapPoint(story);

    if (!point) {
      if (story.map_mode === 'real') invalidRealCount++;
      return;
    }

    const regionInfo = folkRegions[story.region];
    const placeName = story.place_name || 'Chưa ghi tên địa điểm';

    const address = [story.ward, story.street]
      .filter(Boolean)
      .join(', ');

    const label = point.illustrative
      ? 'Vị trí minh họa — không phải nguồn gốc chính xác'
      : 'Địa điểm có thật — tọa độ do người quản trị cung cấp';

    const marker = L.marker([point.lat, point.lng]);

    marker.bindPopup(`
      <div class="map-detail">
        <h3>${esc(story.title)}</h3>
        <p><b>Khu vực:</b> ${esc(regionInfo.name)}</p>
        <p><b>Địa điểm:</b> ${esc(placeName)}</p>
        ${address ? `<p><b>Địa chỉ:</b> ${esc(address)}</p>` : ''}
        <p>${esc(label)}</p>
        <button type="button"
          class="button primary"
          data-story="${esc(story.id)}">
          Đọc truyện này →
        </button>
      </div>
    `);

    marker.on('click', () => {
      if (!details) return;

      details.innerHTML = `
        <article class="map-detail">
          <h3>${esc(story.title)}</h3>
          <p><b>Khu vực:</b> ${esc(regionInfo.name)}</p>
          <p><b>Địa điểm:</b> ${esc(placeName)}</p>
          ${address ? `<p><b>Địa chỉ:</b> ${esc(address)}</p>` : ''}
          <p>${esc(label)}</p>
          <button type="button"
            class="button primary"
            data-story="${esc(story.id)}">
            Đọc truyện này →
          </button>
        </article>
      `;
    });

    marker._folkRegion = story.region;
    marker.addTo(folkMap);
    folkMarkers.push(marker);
    visibleCount++;
  });

  if (details) {
    if (!visibleCount) {
      details.innerHTML = `
        <p>Chưa có truyện đã xuất bản với vị trí bản đồ hợp lệ
        trong khu vực này. Bé có thể bổ sung thông tin ở trang quản trị.</p>
        ${invalidRealCount
          ? `<p>${invalidRealCount} truyện chọn địa điểm có thật nhưng thiếu tọa độ hợp lệ hoặc tọa độ nằm ngoài phạm vi khu vực tham khảo.</p>`
          : ''}
      `;
    } else {
      details.innerHTML = `
        <p>Đang hiển thị ${visibleCount} truyện trên bản đồ.
        Chọn một điểm đánh dấu để xem thông tin và mở truyện.</p>
        ${invalidRealCount
          ? `<p>${invalidRealCount} truyện chưa hiển thị vì tọa độ chưa hợp lệ.</p>`
          : ''}
      `;
    }
  }


if (region) {
  const info = folkRegions[region];

  if (folkMarkers.length) {
    folkMap.fitBounds(
      L.featureGroup(folkMarkers).getBounds().pad(0.15),
      { maxZoom: 11 }
    );
  } else if (info) {
    folkMap.setView(info.center, 9);
  }
} else {
  showWholeVietnam();
}
}
function filterFolkMap() {
  renderFolkMapMarkers();
}


function isFavorite(id){
  return favorites.includes(String(id));
}

async function loadFavorites(){
  favorites=[];

  if(!db||!user){
    updateProfileUI();
    render();
    return;
  }

  let {data,error}=await db
    .from('user_favorites')
    .select('story_id')
    .eq('user_id',user.id);

  if(error){
    console.error('Lỗi tải truyện yêu thích:',error);
    toast('Không tải được truyện yêu thích.',true);
    return;
  }

  favorites=(data||[]).map(x=>String(x.story_id));

  updateProfileUI();
  render();
}
function card(s){
  let d=new DOMParser().parseFromString(
    s.content||'','text/html'
  );

  let text=d.body.textContent.trim();
  let excerpt=s.summary||text.slice(0,140);
  let favorite=isFavorite(s.id);

  return `<article class="card" tabindex="0" data-story="${esc(s.id)}">
    <div class="cover">
      ${s.image_url
        ?`<img src="${esc(s.image_url)}" alt="${esc(s.title)}">`
        :'✦'}
    </div>
    <div class="card-body">
      <span class="tag">${esc(s.category)}</span>
      <button
        type="button"
        class="favorite-btn"
        data-favorite="${esc(s.id)}"
        aria-pressed="${favorite}"
        aria-label="${favorite?'Bỏ yêu thích':'Thêm vào yêu thích'}"
      >${favorite?'♥':'♡'}</button>
      <h3>${esc(s.title)}</h3>
      <p>${esc(excerpt.slice(0,150))}${excerpt.length>150?'…':''}</p>
      <span class="read">ĐỌC CÂU CHUYỆN →</span>
    </div>
  </article>`;
}

function normalize(s){
  return String(s??'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/g,'d')
    .replace(/Đ/g,'D')
    .toLowerCase()
    .trim();
}


function renderSearch(){
  const input=$('search-input');
  const category=$('search-category');
  const sort=$('search-sort');
  const results=$('search-results');
  const status=$('search-status');
  const clear=$('clear-search');

  if(!input||!category||!results||!status||!clear)return;

  const q=normalize(input.value);
  const c=category.value;
  const words=q.split(/\s+/).filter(Boolean);
  const order=sort?sort.value:'relevance';

  clear.hidden=!input.value.trim()&&!c;

  if(!q&&!c){
    results.innerHTML='';
    status.textContent='';
    return;
  }

  const found=stories
    .filter(s=>{
      if(!s.is_published)return false;
      if(c&&s.category!==c)return false;

      const doc=new DOMParser().parseFromString(
        s.content||'','text/html'
      );

      const title=normalize(s.title);
      const summary=normalize(s.summary);
      const cat=normalize(s.category);
      const content=normalize(doc.body.textContent);
      const author=normalize(s.author_name);

      const all=[title,summary,cat,content,author].join(' ');

      return words.every(w=>all.includes(w));
    })
    .map(s=>{
      const doc=new DOMParser().parseFromString(
        s.content||'','text/html'
      );

      const title=normalize(s.title);
      const summary=normalize(s.summary);
      const cat=normalize(s.category);
      const content=normalize(doc.body.textContent);
      const author=normalize(s.author_name);

      let score=0;

      for(const w of words){
        if(title===w)score+=100;
        else if(title.startsWith(w))score+=50;
        else if(title.includes(w))score+=30;

        if(summary.includes(w))score+=10;
        if(cat.includes(w))score+=6;
        if(author.includes(w))score+=3;
        if(content.includes(w))score+=1;
      }

      if(q&&title===q)score+=100;
      else if(q&&title.startsWith(q))score+=40;

      return {...s,_score:score};
    });

  if(order==='title'){
    found.sort((a,b)=>
      normalize(a.title).localeCompare(normalize(b.title),'vi')
    );
  }else if(order==='newest'){
    found.sort((a,b)=>
      (Date.parse(b.updated_at||b.created_at||'')||0)-
      (Date.parse(a.updated_at||a.created_at||'')||0)
    );
  }else{
    found.sort((a,b)=>b._score-a._score);
  }

  if(found.length){
    results.innerHTML=found.map(card).join('');
    status.textContent=`Tìm thấy ${found.length} truyện phù hợp.`;
  }else{
    results.innerHTML=
      '<div class="empty"><b>Chưa tìm thấy truyện phù hợp</b><p>Em thử bỏ bớt từ khóa hoặc chọn thể loại khác nhé.</p></div>';
    status.textContent='Không tìm thấy truyện nào phù hợp.';
  }
}



function render(){
  let pub=stories.filter(s=>s.is_published);
  let feat=pub.filter(s=>s.is_featured);

  $('featured').innerHTML=feat.length
    ?feat.slice(0,6).map(card).join('')
    :empty();

  document.querySelectorAll('.category-grid').forEach(el=>{
    let a=pub.filter(s=>s.category===el.dataset.category);
    el.innerHTML=a.length?a.map(card).join(''):empty();
  });

  let favoriteBox=$('favorite-stories');

  if(favoriteBox){
    let saved=pub.filter(s=>isFavorite(s.id));

    favoriteBox.innerHTML=saved.length
      ?saved.map(card).join('')
      :'<div class="empty"><b>Chưa có truyện yêu thích</b>Hãy nhấn ♡ ở truyện bạn muốn lưu lại nhé.</div>';
  }

  renderSearch();
}



async function load(){
  if(!db){
    console.error('Supabase chưa kết nối');
    render();
    return;
  }

  let {data,error}=await db
    .from('stories')
    .select('*')
    .eq('is_published',true)
    .order('created_at',{ascending:false});

  console.log('TRUYỆN TẢI ĐƯỢC:',data);
  console.log('LỖI SUPABASE:',error);

  if(error){
    console.error(error);
    render();
    return;
  }

  stories=data||[];
  render();
}

function modal(id,open){$(id).hidden=!open;document.body.style.overflow=open?'hidden':''}
function authTab(m){mode=m;$('auth-title').textContent=m==='login'?'Đăng nhập':'Tạo tài khoản';$('auth-submit').textContent=m==='login'?'Đăng nhập':'Đăng ký';$('login-tab').classList.toggle('selected',m==='login');$('signup-tab').classList.toggle('selected',m==='signup');$('auth-message').textContent=''}
async function refresh(){
  if(!db)return;

  let r=await db.auth.getUser();
  user=r.data.user;
  admin=false;

  if(user){
    let a=await db
      .from('admin_users')
      .select('user_id')
      .eq('user_id',user.id)
      .maybeSingle();

    admin=!!a.data&&!a.error;
  }

  $('open-auth').textContent=
    user?(admin?'Quản trị':'Tài khoản'):'Đăng nhập';

  await loadFavorites();
  updateProfileUI();
}

function updateProfileUI(){
  if(!$('profile-name'))return;

  const avatar=$('profile-avatar');
  const placeholder=$('profile-avatar-placeholder');

  if(user){
    $('profile-name').textContent=
      user.user_metadata?.full_name||
      user.email?.split('@')[0]||
      'Độc giả DI SẢN VIỆT';

    $('profile-email').textContent=user.email||'';
    $('profile-message').textContent='';

    const url=user.user_metadata?.avatar_url;

    if(avatar && url){
      avatar.src=url;
      avatar.hidden=false;
      if(placeholder)placeholder.hidden=true;
    }else{
      if(avatar){
        avatar.removeAttribute('src');
        avatar.hidden=true;
      }
      if(placeholder)placeholder.hidden=false;
    }
  }else{
    $('profile-name').textContent='Độc giả DI SẢN VIỆT';
    $('profile-email').textContent=
      'Đăng nhập để xem thông tin tài khoản';
    $('profile-message').textContent=
      'Bé hãy đăng nhập để sử dụng các tính năng cá nhân nhé.';

    if(avatar){
      avatar.removeAttribute('src');
      avatar.hidden=true;
    }
    if(placeholder)placeholder.hidden=false;
  }

 $('stat-favorite').textContent=favorites.length;
}


async function submitAuth(e){e.preventDefault();if(!db){$('auth-message').textContent='Chưa cấu hình Supabase trong config.js.';return}let email=$('auth-email').value.trim(),password=$('auth-password').value;try{let r=mode==='login'?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password});if(r.error)throw r.error;if(mode==='signup'){$('auth-message').textContent='Đã gửi yêu cầu đăng ký. Kiểm tra email nếu cần xác nhận.';return}await refresh();modal('auth-modal',false);if(admin)await openAdmin();else toast('Đăng nhập thành công.')}catch(e){$('auth-message').textContent=e.message||'Không thể đăng nhập.'}}
async function openAdmin(){await refresh();if(!user){modal('auth-modal',true);$('auth-message').textContent='Đăng nhập tài khoản quản trị trước nhé.';return}if(!admin){toast('Tài khoản này chưa được cấp quyền quản trị.',true);return}$('admin-user').textContent=user.email;modal('admin-modal',true);await adminList()}
function tab(name){
  document.querySelectorAll('.admin-tab').forEach(b=>{
    b.classList.toggle('selected',b.dataset.tab===name);
  });

  $('admin-list').hidden=name!=='list';
  $('admin-editor').hidden=name!=='editor';
  $('admin-map').hidden=name!=='map';

  if(name==='map'){
    renderAdminMapStories();
  }
}
function updateAdminStats(data){
  const total=data.length;
  const published=data.filter(s=>s.is_published).length;
  const drafts=total-published;
  const categories=new Set(
    data.map(s=>s.category).filter(Boolean)
  ).size;

  if($('admin-total'))
    $('admin-total').textContent=total;

  if($('admin-published'))
    $('admin-published').textContent=published;

  if($('admin-drafts'))
    $('admin-drafts').textContent=drafts;

  if($('admin-categories'))
    $('admin-categories').textContent=categories;
}

async function adminList(){
  let r=await db
    .from('stories')
    .select('*')
    .order('created_at',{ascending:false});

  if(r.error){
    toast(r.error.message,true);
    return;
  }

  stories=r.data||[];

  updateAdminStats(stories);
  render();

  $('admin-stories').innerHTML=stories.length
    ?stories.map(s=>`
      <div class="admin-row">
        <div>
          <b>${esc(s.title)}</b>
          <small>
            ${esc(s.category)} ·
            ${s.is_published?'Đã xuất bản':'Bản nháp'}
            ${s.is_featured?' · Nổi bật':''}
          </small>
        </div>
        <div>
          <button data-edit="${s.id}">Sửa</button>
          <button data-publish="${s.id}">
            ${s.is_published?'Gỡ xuất bản':'Xuất bản'}
          </button>
          <button class="danger" data-delete="${s.id}">
            Xóa
          </button>
        </div>
      </div>
    `).join('')
    :empty();
}
function renderAdminMapStories(){
  const select=$('map-story-select');
  if(!select)return;

  const oldValue=select.value;

  const published=stories.filter(s=>s.is_published);

  select.innerHTML=
    '<option value="">-- Chọn truyện --</option>'+
    published.map(s=>
      `<option value="${esc(s.id)}">${esc(s.title)}</option>`
    ).join('');

  if(published.some(s=>String(s.id)===oldValue)){
    select.value=oldValue;
  }
}
  async function addStoryToMap(e){
  e.preventDefault();

  const message=$('map-story-message');
  const id=$('map-story-select').value;
  const region=$('map-story-region').value;
  const place=$('map-story-place').value.trim();
  const ward=$('map-story-ward').value.trim();
  const address=$('map-story-address').value.trim();

  if(!db||!admin||!user){
    message.textContent='Vui lòng đăng nhập tài khoản quản trị.';
    return;
  }

  const story=stories.find(s=>String(s.id)===String(id));

  if(!story||!story.is_published){
    message.textContent='Vui lòng chọn một truyện đã xuất bản.';
    return;
  }

  const regionInfo=folkRegions[region];

  if(!regionInfo||!place){
    message.textContent='Vui lòng chọn khu vực và nhập tên địa điểm.';
    return;
  }

  const button=$('map-story-form').querySelector(
    'button[type="submit"]'
  );

  button.disabled=true;
  message.textContent='Đang xác minh địa điểm...';

  try{
    const query=[
      place,
      ward,
      address,
      regionInfo.name,
      'Vietnam'
    ].filter(Boolean).join(', ');

    const params=new URLSearchParams({
      format:'jsonv2',
      limit:'1',
      countrycodes:'vn',
      q:query
    });

    const response=await fetch(
      'https://nominatim.openstreetmap.org/search?'+params.toString(),
      {headers:{'Accept':'application/json'}}
    );

    if(!response.ok){
      throw Error('Dịch vụ tìm địa điểm đang gặp lỗi. Bé thử lại sau nhé.');
    }

    const results=await response.json();

    if(!results.length){
      throw Error('Không tìm thấy địa điểm. Bé thử bổ sung địa chỉ cụ thể hơn nhé.');
    }

    const lat=Number(results[0].lat);
    const lng=Number(results[0].lon);

    const [minLat,maxLat,minLng,maxLng]=regionInfo.bounds;

    if(
      !Number.isFinite(lat)||!Number.isFinite(lng)||
      lat<minLat||lat>maxLat||
      lng<minLng||lng>maxLng
    ){
      throw Error(
        'Kết quả tìm được nằm ngoài phạm vi khu vực đã chọn. Bé kiểm tra lại tên địa điểm hoặc khu vực nhé.'
      );
    }

    message.textContent='Đã xác minh vị trí, đang lưu...';

    const {error}=await db
      .from('stories')
      .update({
        region:region,
        map_mode:'real',
        place_name:place,
        ward:ward||null,
        street:address||null,
        latitude:lat,
        longitude:lng
      })
      .eq('id',story.id)
      .eq('is_published',true);

    if(error)throw error;

    $('map-story-form').reset();
    await adminList();
    renderAdminMapStories();

    message.textContent='Đã thêm địa điểm vào bản đồ thành công!';
    toast('Đã cập nhật địa điểm truyện.');

    if(folkMap){
      renderFolkMapMarkers();
    }

  }catch(err){
    console.error('Lỗi thêm truyện vào bản đồ:',err);
    message.textContent=err.message||'Không thể thêm địa điểm vào bản đồ.';
  }finally{
    button.disabled=false;
  }
}
function reset(){
  $('story-form').reset();
  $('story-id').value='';
 if ($('story-video')) $('story-video').value = '';
  imagePath=null;
  audioPath=null;
  audioFile=null;
     videoPath=null;
  videoFile=null;
  storyHtml='';
  storyTextSnapshot='';
  $('editor-title').textContent='Thêm truyện mới';
  $('story-message').textContent='';
  $('docx').value='';
  $('story-image').value='';
  $('story-audio').value='';
}

function edit(id){
  let s=stories.find(x=>x.id===id);
  if(!s)return;

  reset();

  $('story-id').value=s.id;
  $('story-name').value=s.title;
  $('story-category').value=s.category;
  $('story-summary').value=s.summary||'';
  
$('story-region').value=s.region||'';
$('story-map-mode').value=s.map_mode||'none';
$('story-place-name').value=s.place_name||'';
$('story-ward').value=s.ward||'';
$('story-street').value=s.street||'';
$('story-latitude').value=s.latitude??'';
$('story-longitude').value=s.longitude??'';


  let doc=new DOMParser().parseFromString(
    s.content||'','text/html'
  );

  let text=doc.body.textContent.trim();

  if(s.content&&/<(p|h[1-6]|img|ul|ol|table|blockquote)\b/i.test(s.content)){
    storyHtml=s.content;
    storyTextSnapshot=text;
    $('story-text').value=text;
  }else{
    storyHtml='';
    storyTextSnapshot='';
    $('story-text').value=s.content||'';
  }

  $('featured').checked=s.is_featured;
  $('published').checked=s.is_published;
  imagePath=s.image_path;
  audioPath=s.audio_path||null;
    videoPath=s.video_path||null;
  $('editor-title').textContent='Chỉnh sửa truyện';

  tab('editor');
}


async function save(e){
  e.preventDefault();

  if(!db||!admin||!user)return;

  let id=$('story-id').value;
  let text=$('story-text').value.trim();

  if(!storyHtml&&!text){
    $('story-message').textContent='Vui lòng nhập nội dung truyện.';
    return;
  }

  if(storyHtml&&text!==storyTextSnapshot){
    $('story-message').textContent='Nội dung đã thay đổi. Em hãy chỉnh sửa trong file Word rồi tải lại để giữ ảnh minh họa.';
    return;
  }

  let p={
    title:$('story-name').value.trim(),
    category:$('story-category').value,
    summary:$('story-summary').value.trim(),
    
    region:$('story-region').value,
    map_mode:$('story-map-mode').value,
    place_name:$('story-place-name').value.trim(),
    ward:$('story-ward').value.trim(),
    street:$('story-street').value.trim(),
    latitude:$('story-latitude').value.trim()===''
      ?null:Number($('story-latitude').value),
    longitude:$('story-longitude').value.trim()===''
      ?null:Number($('story-longitude').value),

    content:storyHtml||text,
    is_featured:$('featured').checked,
    is_published:$('published').checked,
    author_name:user.email||''
  };

  if(!p.title){
    $('story-message').textContent='Vui lòng nhập tên truyện.';
    return;
  }

  try{
    // 1. Ảnh bìa
    let file=$('story-image').files[0];

    if(file){
      if(file.size>5*1024*1024){
        throw Error('Ảnh bìa cần nhỏ hơn 5 MB.');
      }

      let ext=file.name.split('.').pop().toLowerCase();
      let path=`${user.id}/${crypto.randomUUID()}.${ext}`;

      let up=await db.storage
        .from('story-images')
        .upload(path,file,{
          contentType:file.type
        });

      if(up.error)throw up.error;

      p.image_path=path;
      p.image_url=db.storage
        .from('story-images')
        .getPublicUrl(path).data.publicUrl;
    }else if(id){
      let old=stories.find(s=>String(s.id)===String(id));
      p.image_path=old?.image_path||null;
      p.image_url=old?.image_url||null;
    }

    // 2. Âm thanh
    let audio=audioFile;

    if(audio){
      if(!audio.name.toLowerCase().endsWith('.mp3')){
        throw Error('Vui lòng chọn file MP3.');
      }

      if(audio.size>20*1024*1024){
        throw Error('File nghe truyện cần nhỏ hơn 20 MB.');
      }

      let path=`${user.id}/${crypto.randomUUID()}.mp3`;

      $('story-message').textContent='Đang tải âm thanh lên...';

      let up=await db.storage
        .from('story-audio')
        .upload(path,audio,{
          contentType:'audio/mpeg'
        });

      if(up.error)throw up.error;

      p.audio_path=path;
    }else if(id){
      let old=stories.find(s=>String(s.id)===String(id));
      p.audio_path=old?.audio_path||null;
    }

   
    // 3. Video
    const selectedVideo = $('story-video')?.files?.[0] || videoFile;

    if (selectedVideo) {
      if (!selectedVideo.name.toLowerCase().endsWith('.mp4')) {
        throw Error('Vui lòng chọn video MP4.');
      }

      if (selectedVideo.size > 50 * 1024 * 1024) {
        throw Error('Video cần nhỏ hơn 50 MB.');
      }

      const videoPath = `${user.id}/${crypto.randomUUID()}.mp4`;

      $('story-message').textContent = 'Đang tải video lên...';

      console.log('BẮT ĐẦU TẢI VIDEO:', selectedVideo.name, selectedVideo.size);

      const videoUpload = await db.storage
        .from('story-videos')
        .upload(videoPath, selectedVideo, {
          contentType: 'video/mp4',
          upsert: false
        });

      if (videoUpload.error) {
        console.error('LỖI UPLOAD VIDEO:', videoUpload.error);
        throw videoUpload.error;
      }

      console.log('TẢI VIDEO THÀNH CÔNG:', videoPath);
      p.video_path = videoPath;

      $('story-message').textContent = 'Video đã tải lên, đang lưu truyện...';
    } else if (id) {
      const old = stories.find(s => String(s.id) === String(id));
      p.video_path = old?.video_path || null;
    } else {
      p.video_path = null;
    }

    // 4. Lưu truyện
    let r=id
      ?await db.from('stories').update(p).eq('id',id)
      :await db.from('stories').insert(p);

    if(r.error)throw r.error;

    toast(id?'Đã cập nhật truyện.':'Đã thêm truyện.');
    reset();
    tab('list');
    await adminList();

  }catch(err){
    console.error('LỖI LƯU TRUYỆN:',err);
    $('story-message').textContent=
      err.message||'Không lưu được truyện.';
  }
}



function initTheme(){
  const btn=$('theme-toggle');
  if(!btn)return;

  let saved='light';

  try{
    saved=localStorage.getItem('vietTalesTheme')||'light';
  }catch(e){}

  function applyTheme(theme){
    document.body.dataset.theme=theme;

    btn.textContent=theme==='dark'
      ?'☀️ Chế độ sáng'
      :'🌙 Chế độ tối';

    try{
      localStorage.setItem('vietTalesTheme',theme);
    }catch(e){}
  }

  applyTheme(saved);

  btn.addEventListener('click',()=>{
    const next=
      document.body.dataset.theme==='dark'
        ?'light'
        :'dark';

    applyTheme(next);
  });
}

async function init(){
  initTheme();
  await load();

  const searchInput=$('search-input');
  const searchCategory=$('search-category');
  const searchSort=$('search-sort');
  const clearSearch=$('clear-search');

  if(searchInput){
    searchInput.addEventListener('input',renderSearch);
  }

  if(searchCategory){
    searchCategory.addEventListener('change',renderSearch);
  }

  if(searchSort){
    searchSort.addEventListener('change',renderSearch);
  }

  if(clearSearch){
    clearSearch.addEventListener('click',()=>{
      if(searchInput)searchInput.value='';
      if(searchCategory)searchCategory.value='';
      if(searchSort)searchSort.value='relevance';

      renderSearch();

      if(searchInput)searchInput.focus();
    });
  }
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','#'+a.dataset.page);page(a.dataset.page)}));window.addEventListener('hashchange',()=>page((location.hash||'#trang-chu').slice(1)));page((location.hash||'#trang-chu').slice(1));$('menu-toggle').onclick=()=>$('nav').classList.toggle('open');$('open-auth').onclick=async()=>{if(user&&admin)await openAdmin();else modal('auth-modal',true)};$('login-tab').onclick=()=>authTab('login');$('signup-tab').onclick=()=>authTab('signup');$('auth-form').onsubmit=submitAuth;$('view-favorites').onclick=()=>{
  if(!user){
    modal('auth-modal',true);
    $('auth-message').textContent=
      'Bạn đăng nhập để xem truyện yêu thích nhé.';
    return;
  }

  $('favorite-stories').scrollIntoView({
    behavior:'smooth',
    block:'start'
  });
};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>modal(b.dataset.close,false));document.querySelectorAll('.backdrop').forEach(b=>b.onclick=e=>{if(e.target===b)modal(b.id,false)});
document.addEventListener('click',async e=>{
  let fav=e.target.closest('[data-favorite]');
  if(fav){
    e.preventDefault();
    e.stopPropagation();

    if(!user){
      modal('auth-modal',true);
      $('auth-message').textContent=
        'Bé đăng nhập để lưu truyện yêu thích nhé.';
      return;
    }

    let id=String(fav.dataset.favorite);
    let exists=favorites.includes(id);

    fav.disabled=true;

    try{
      if(exists){
        let {error}=await db
          .from('user_favorites')
          .delete()
          .eq('user_id',user.id)
          .eq('story_id',id);

        if(error)throw error;

        favorites=favorites.filter(x=>x!==id);
        toast('Đã bỏ truyện khỏi yêu thích.');
      }else{
        let {error}=await db
          .from('user_favorites')
          .insert({
            user_id:user.id,
            story_id:id
          });

        if(error)throw error;

        favorites.push(id);
        toast('Đã thêm truyện vào yêu thích.');
      }

      render();
      updateProfileUI();
    }catch(err){
      console.error('Lỗi lưu yêu thích:',err);
      toast('Không lưu được yêu thích: '+err.message,true);
    }
    return;
  }

  let c=e.target.closest('[data-story]');

  if(c){
    let s=stories.find(x=>String(x.id)===c.dataset.story);
 
    if(s){$('reader-category').textContent=s.category;
          $('reader-title').textContent=s.title;
          $('reader-meta').textContent=s.author_name||'Kho tàng truyện dân gian địa phương';
          let audioBox=$('reader-audio-box');
let audioPlayer=$('reader-audio');

audioPlayer.pause();
audioPlayer.removeAttribute('src');
audioPlayer.load();

if(s.audio_path){
  audioPlayer.src=db.storage
    .from('story-audio')
    .getPublicUrl(s.audio_path).data.publicUrl;

  audioBox.hidden=false;
}else{
  audioBox.hidden=true;
}
let doc=new DOMParser().parseFromString(
  s.content||'','text/html'
);

let box=$('reader-content');
box.replaceChildren();

let allowed=[
  'P','BR','STRONG','B','EM','I','U',
  'H1','H2','H3','UL','OL','LI',
  'BLOCKQUOTE','IMG','TABLE','THEAD',
  'TBODY','TR','TD','TH'
];

function addSafe(parent,node){
  if(node.nodeType===3){
    parent.appendChild(document.createTextNode(node.textContent));
    return;
  }

  if(node.nodeType!==1)return;

  if(!allowed.includes(node.tagName)){
    node.childNodes.forEach(n=>addSafe(parent,n));
    return;
  }

  let el=document.createElement(node.tagName.toLowerCase());

  if(node.tagName==='IMG'){
    let src=node.getAttribute('src')||'';

  
if (!src.startsWith('https://')) {
  console.error('Đường dẫn ảnh không hợp lệ:', src);
  return;
}

el.onload=()=>console.log('Ảnh hiển thị thành công:',src);
el.onerror=()=>console.error('Ảnh không tải được:',src);
el.src=src;
    el.alt=node.getAttribute('alt')||'';
    el.loading='lazy';
  }

  node.childNodes.forEach(n=>addSafe(el,n));
  parent.appendChild(el);
}

doc.body.childNodes.forEach(n=>addSafe(box,n));

if(!box.childNodes.length){
  box.textContent=s.content||'';
}

if(s.video_path && db){
  const video=document.createElement('video');

  video.controls=true;
  video.preload='metadata';
  video.playsInline=true;
  video.style.width='100%';
  video.style.maxWidth='100%';
  video.style.maxHeight='480px';
  video.style.display='block';
  video.style.margin='24px auto';
  video.style.borderRadius='12px';

  video.src=db.storage
    .from('story-videos')
    .getPublicUrl(s.video_path).data.publicUrl;

  box.appendChild(video);
}

modal('reader-modal',true);
}
return;
}
let ed=e.target.closest('[data-edit]');if(ed){edit(ed.dataset.edit);return}let pub=e.target.closest('[data-publish]');if(pub){let s=stories.find(x=>x.id===pub.dataset.publish);let r=await db.from('stories').update({is_published:!s.is_published}).eq('id',s.id);if(r.error)toast(r.error.message,true);else await adminList();return}let del=e.target.closest('[data-delete]');if(del){let s=stories.find(x=>x.id===del.dataset.delete);if(s&&confirm(`Xóa truyện “${s.title}”?`)){let r=await db.from('stories').delete().eq('id',s.id);if(r.error)toast(r.error.message,true);else await adminList()} }});$('new-story').onclick=()=>{reset();tab('editor')};$('cancel-edit').onclick=()=>{reset();tab('list')};document.querySelectorAll('.admin-tab').forEach(b=>{
  b.onclick=()=>{
    if(b.dataset.tab==='editor'&&!$('story-id').value){
      reset();
    }

    tab(b.dataset.tab);
  };
});$('story-form').onsubmit=save;
 const mapForm = $('map-story-form');

if (mapForm) {
  mapForm.onsubmit = async e => {
    console.log('[VietTales] Form bản đồ đã gửi.');
    const message = $('map-story-message');

    if (message) {
      message.textContent = 'Đã nhận yêu cầu, đang kiểm tra...';
    }

    try {
      await addStoryToMap(e);
    } catch (err) {
      console.error('[VietTales] Lỗi form bản đồ:', err);

      if (message) {
        message.textContent =
          'Có lỗi: ' + (err.message || String(err));
      }
    }
  };
} else {
  console.error('[VietTales] Không tìm thấy map-story-form.');
}
const audioInput = $('story-audio');
if (audioInput) {
  audioInput.onchange = e => {
    audioFile = e.target.files[0] || null;
  };
}

const videoInput = $('story-video');
if (videoInput) {
  videoInput.onchange = e => {
    videoFile = e.target.files[0] || null;
  };
}
$('avatar-upload').onchange=async e=>{
    const file=e.target.files[0];

  if(!file)return;

  const message=$('profile-message');

  try{
    if(!db||!user){
      throw Error('Bé hãy đăng nhập trước khi đổi ảnh nhé.');
    }

    const types={
      'image/jpeg':'jpg',
      'image/png':'png',
      'image/webp':'webp',
      'image/gif':'gif'
    };

    if(!types[file.type]){
      throw Error('Bé hãy chọn ảnh JPG, PNG, WEBP hoặc GIF nhé.');
    }

    if(file.size>5*1024*1024){
      throw Error('Ảnh đại diện phải nhỏ hơn 5 MB nhé.');
    }

    message.textContent='Đang tải ảnh lên...';

    const ext=types[file.type];
    const path=`${user.id}/avatar-${crypto.randomUUID()}.${ext}`;

    const upload=await db.storage
      .from('story-images')
      .upload(path,file,{
        contentType:file.type
      });

    if(upload.error)throw upload.error;

    const url=db.storage
      .from('story-images')
      .getPublicUrl(path).data.publicUrl;

    const result=await db.auth.updateUser({
      data:{avatar_url:url}
    });

    if(result.error)throw result.error;

    user=result.data.user||user;
    updateProfileUI();

    message.textContent='Đổi ảnh đại diện thành công! 💗';
  }catch(err){
    console.error('Lỗi đổi ảnh đại diện:',err);
    message.textContent=
      'Không đổi được ảnh: '+err.message;
  }finally{
    e.target.value='';
  }
};

$('docx').onchange=async e=>{
  let f=e.target.files[0];
  if(!f)return;

  storyHtml='';
  storyTextSnapshot='';

  try{
    if(!f.name.toLowerCase().endsWith('.docx')){
      throw Error('Vui lòng chọn file Word .docx.');
    }

    if(!db||!admin||!user){
      throw Error('Vui lòng đăng nhập tài khoản quản trị.');
    }

    $('story-message').textContent='Đang đọc nội dung và tải ảnh lên...';

    let r=await mammoth.convertToHtml(
      {arrayBuffer:await f.arrayBuffer()},
      {
        convertImage:mammoth.images.imgElement(async image=>{
          let types={
            'image/jpeg':'jpg',
            'image/png':'png',
            'image/webp':'webp',
            'image/gif':'gif'
          };

          let ext=types[image.contentType];

          if(!ext){
            throw Error('Ảnh trong Word phải có định dạng JPG, PNG, WEBP hoặc GIF.');
          }

          let base64=await image.read('base64');
          let bytes=Uint8Array.from(
            atob(base64),
            c=>c.charCodeAt(0)
          );

          if(bytes.byteLength>5*1024*1024){
            throw Error('Có ảnh trong Word lớn hơn 5 MB.');
          }

          let path=`${user.id}/word/${crypto.randomUUID()}.${ext}`;

          let up=await db.storage
            .from('story-images')
            .upload(path,bytes,{
              contentType:image.contentType
            });

          if(up.error)throw up.error;

          let url=db.storage
            .from('story-images')
            .getPublicUrl(path).data.publicUrl;

          return {src:url};
        })
      }
    );

    storyHtml=r.value;
    console.log('HTML Word:', r.value);
console.log('Số ảnh đọc được:', (r.value.match(/<img\b/gi)||[]).length);

    let doc=new DOMParser().parseFromString(
      storyHtml,'text/html'
    );

    storyTextSnapshot=doc.body.textContent.trim();
    $('story-text').value=storyTextSnapshot;

    if(!$('story-name').value){
      $('story-name').value=f.name
        .replace(/\.docx$/i,'')
        .replace(/[_-]/g,' ');
    }

    $('story-message').textContent=
      'Đã đọc nội dung Word và tải ảnh minh họa. Hãy kiểm tra trước khi lưu.';
  }catch(err){
    storyHtml='';
    storyTextSnapshot='';
    $('story-message').textContent=
      err.message||'Không đọc được file Word.';
  }
};

$('logout').onclick=async()=>{
  await db.auth.signOut();

  user=null;
  admin=false;
  favorites=[];

  $('open-auth').textContent='Đăng nhập';

  updateProfileUI();
  render();

  modal('admin-modal',false);
  toast('Đã đăng xuất.');
};
}
document.addEventListener('DOMContentLoaded',init);
})();
