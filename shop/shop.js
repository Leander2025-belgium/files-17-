const products = [
  {id:'bottle',name:'Wheaterflow Drinkfles',category:'accessoires',price:24.95,symbol:'💧',desc:'Stevige herbruikbare drinkfles met Wheaterflow-branding. Klaar voor het uiteindelijke productbeeld.',badge:'Bestseller',options:{Kleur:['Wit','Zwart'],Inhoud:['500 ml']}},
  {id:'mug',name:'Wheaterflow Mok',category:'accessoires',price:16.95,symbol:'☕',desc:'Minimalistische mok voor je ochtendverwachting, koffie of thee.',options:{Kleur:['Wit','Donkerblauw']}},
  {id:'hoodie',name:'Wheaterflow Hoodie',category:'kleding',price:54.95,symbol:'🧥',desc:'Zachte premium hoodie met subtiele Wheaterflow-uitstraling.',badge:'Nieuw',options:{Maat:['XS','S','M','L','XL','XXL'],Kleur:['Navy','Zwart','Grijs']}},
  {id:'shirt',name:'Wheaterflow T-shirt',category:'kleding',price:29.95,symbol:'👕',desc:'Clean T-shirt voor dagelijks gebruik met Wheaterflow-logo.',options:{Maat:['XS','S','M','L','XL','XXL'],Kleur:['Wit','Navy','Zwart']}},
  {id:'stickers',name:'Wheaterflow Sticker Pack',category:'stickers',price:7.95,symbol:'🌦️',desc:'Set weerbestendige Wheaterflow-stickers voor laptop, fles of koffer.',badge:'Populair',options:{Set:['5 stickers']}},
  {id:'totebag',name:'Wheaterflow Tote Bag',category:'accessoires',price:19.95,symbol:'👜',desc:'Praktische draagtas met een rustige Wheaterflow-print.',options:{Kleur:['Naturel','Zwart']}},
];
const euro = n => new Intl.NumberFormat('nl-BE',{style:'currency',currency:'EUR'}).format(n);
let cart = JSON.parse(localStorage.getItem('wf-shop-cart')||'[]');
let currentProduct=null, currentOptions={};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function renderProducts(filter='all'){
  $('#productGrid').innerHTML = products.filter(p=>filter==='all'||p.category===filter).map(p=>`
    <article class="product-card" data-id="${p.id}">
      <div class="product-media"><div class="product-symbol">${p.symbol}</div><span class="media-note">Productfoto volgt</span></div>
      <div class="product-copy">
        <div class="product-topline"><div>${p.badge?`<span class="eyebrow">${p.badge.toUpperCase()}</span>`:''}<h3>${p.name}</h3></div><div class="price">${euro(p.price)}</div></div>
        <p>${p.desc}</p>
        <div class="card-actions"><button class="btn ghost info-btn" data-id="${p.id}">Bekijken</button><button class="btn primary quick-add" data-id="${p.id}">+ Mandje</button></div>
      </div>
    </article>`).join('');
}
function save(){localStorage.setItem('wf-shop-cart',JSON.stringify(cart)); renderCart();}
function addToCart(id, options={}){const p=products.find(x=>x.id===id);const key=id+JSON.stringify(options);const found=cart.find(x=>x.key===key);if(found)found.qty++;else cart.push({key,id,qty:1,options});save();toast(`${p.name} toegevoegd`)}
function renderCart(){
  const count=cart.reduce((a,b)=>a+b.qty,0);$('#cartCount').textContent=count;
  const items=$('#cartItems'),empty=$('#cartEmpty');empty.style.display=count?'none':'block';items.style.display=count?'block':'none';
  items.innerHTML=cart.map((item,i)=>{const p=products.find(x=>x.id===item.id);return `<div class="cart-item"><div class="cart-thumb">${p.symbol}</div><div class="cart-meta"><strong>${p.name}</strong><small>${Object.values(item.options||{}).join(' · ')||'Standaard'}</small><div class="qty"><button data-act="minus" data-i="${i}">−</button><span>${item.qty}</span><button data-act="plus" data-i="${i}">+</button></div></div><div style="text-align:right"><strong>${euro(p.price*item.qty)}</strong><br><button class="remove" data-act="remove" data-i="${i}">Verwijder</button></div></div>`}).join('');
  const sub=cart.reduce((sum,item)=>sum+products.find(p=>p.id===item.id).price*item.qty,0);const shipping=sub? (sub>=60?0:4.95):0;$('#subtotal').textContent=euro(sub);$('#shipping').textContent=!sub?'—':shipping===0?'Gratis':euro(shipping);$('#total').textContent=euro(sub+shipping);$('#checkoutBtn').disabled=!count;
}
function openCart(){ $('#overlay').hidden=false;$('#cartDrawer').classList.add('open');$('#cartDrawer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden'; }
function closeCart(){ $('#cartDrawer').classList.remove('open');$('#cartDrawer').setAttribute('aria-hidden','true');$('#overlay').hidden=true;document.body.style.overflow=''; }
function openProduct(id){currentProduct=products.find(p=>p.id===id);currentOptions={};$('#modalMedia').textContent=currentProduct.symbol;$('#modalCategory').textContent=currentProduct.category.toUpperCase();$('#modalTitle').textContent=currentProduct.name;$('#modalDescription').textContent=currentProduct.desc;$('#modalPrice').textContent=euro(currentProduct.price);const opts=$('#modalOptions');opts.innerHTML=Object.entries(currentProduct.options||{}).map(([name,vals])=>{currentOptions[name]=vals[0];return `<div class="option-row"><label>${name}</label><div class="chips">${vals.map((v,i)=>`<button class="chip ${i===0?'active':''}" data-option="${name}" data-value="${v}">${v}</button>`).join('')}</div></div>`}).join('');$('#productModal').showModal()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),1800)}
function openCheckout(){if(!cart.length)return;closeCart();const rows=cart.map(x=>{const p=products.find(y=>y.id===x.id);return `<div style="display:flex;justify-content:space-between;margin:6px 0"><span>${x.qty}× ${p.name}</span><strong>${euro(x.qty*p.price)}</strong></div>`}).join('');$('#orderPreview').innerHTML=`<strong style="color:#fff">Je bestelling</strong>${rows}`;$('#checkoutModal').showModal()}

renderProducts();renderCart();
$('#openCart').onclick=$('#heroCart').onclick=openCart;$('#closeCart').onclick=closeCart;$('#overlay').onclick=closeCart;$('#checkoutBtn').onclick=openCheckout;$('#modalClose').onclick=()=>$('#productModal').close();$('#checkoutClose').onclick=()=>$('#checkoutModal').close();
$('#productGrid').addEventListener('click',e=>{const id=e.target.dataset.id;if(!id)return;if(e.target.classList.contains('quick-add')){const p=products.find(x=>x.id===id);const defaults=Object.fromEntries(Object.entries(p.options||{}).map(([k,v])=>[k,v[0]]));addToCart(id,defaults)}else openProduct(id)});
$('#filters').addEventListener('click',e=>{if(!e.target.matches('.filter'))return;$$('.filter').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');renderProducts(e.target.dataset.filter)});
$('#cartItems').addEventListener('click',e=>{const i=Number(e.target.dataset.i);if(Number.isNaN(i))return;const act=e.target.dataset.act;if(act==='plus')cart[i].qty++;if(act==='minus')cart[i].qty=Math.max(1,cart[i].qty-1);if(act==='remove')cart.splice(i,1);save()});
$('#modalOptions').addEventListener('click',e=>{if(!e.target.classList.contains('chip'))return;const name=e.target.dataset.option;currentOptions[name]=e.target.dataset.value;e.target.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));e.target.classList.add('active')});
$('#modalAdd').onclick=()=>{addToCart(currentProduct.id,currentOptions);$('#productModal').close();openCart()};
$('#checkoutForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target);const name=fd.get('firstName');$('#checkoutModal').close();toast(`Dank je ${name} — checkout klaar voor betaalintegratie`)});
