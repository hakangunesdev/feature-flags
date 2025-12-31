from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import init_db
from app.routers import sdk, admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
"""
pythonda bazen bir işlemi yaptığın zaman bu işlemi kapatman gerekir,örnek olarak dosya işlemleri,dosya açıldıktan sonra
kapatılması gerekir işte bunu pythonda oto olarak yapan with ifadesi vardır,bu with ifadesinn arka planında şu çalışır,
__enter__,__exit ifadeleri.
ama bunun için __enter__,__exit__ ifadesini kullanmak ifadeyi yavaşlatıyor,işte bu işlemi oto olarak hızlıca
yapan @asynccontextmanager ifadesi vardır,bu ifade yield olan kısma kadar kod yapıların çalıştırır,işlem bittikten sonra 
yield ifadesinin altındaki bütün işleri oto sonlandırır.(şu an biz oto sonlandırması için herhangi bir ifade koymamışız.)
init_db() ise db.py içerisindeki db tablolarını oto oluşturan fonksiyondur.
-----kısacası fastapi uygulması açılırken yapılacak olan işleri ve kapanırken yapılacak temizliği barındırır.
"""

app = FastAPI(title="Feature Flags & Remote Config", lifespan=lifespan)
"""
-FastAPI kısmı bir uygulama nesnesi oluşturuyor.bu nesnenin içinde endpointler,routerlar uygulama ayarları gibi bütün her şey
bulunuyor.kısacası benim backendim.
-title kısmı swagger'da görünen başlık.
-lifespan ise uygulamamın başlarken neyi kullanacağı,o da lifespan metotu oluyor.
"""

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
"""
bu metot tarayıcı ile backend arasında kural tanımlaması yapar,yani kod yapısına geçersek 
-CORSMiddleware ifadesi özellikle tarayıcı istekleri için altında yer alan kod yapıları gibi headerları tanımlar.
-allow_origins ifadesi her yerden gelen isteğe izin ver der yani http://localhost:5173,http://127.0.0.1:5173 gibi
adreslerden izin ver der(normalde bunlar sınırlı olur.)
-allow_credentials ifadesi cookie gibi şeylerin gitmesine izin verir.böylece oturum açma işlemleri gibi özelliklerde
kolaylık sağlanır.
-allow_methods ifadesi frontend'in hangi http metotlarını(get,post,patch,delete) göndereceğini kontrol eder.
-allow_headers ifadesi frontend'in hangi headlerları(X-AdminKey,X-SDK-Key) göndereceğini kontrol eder.
"""

BASE_DIR = Path(__file__).resolve().parent
UI_DIR = BASE_DIR / "ui"

app.mount("/ui", StaticFiles(directory=str(UI_DIR), html=True), name="ui")
"""
ilk satırdaki ifadedeki Path(__file__) ifadesi şu an içinde olduğumuz dosyanın yolunu almaktadır,resolve ifadesi bu yolda 
herhangi bir / gibi bir kullanım hatası varsa bunları düzeltir,parent ifadesi bu __file_dosyasının yani main.py dosyasının
içinde olduğu(..app/) dosyanın yolunu tut der,böylece BASE_DIR ifadesi ..app yolunu tutar.
-UI_DIR ifadesi ise BASE_DIR içerisine ui diye bir tane klasör oluştur der.
-app.mount ifadesi ise bir nebi bağlama işlemi yapmaktadır.bu ifadenin içerisindeki ilk parametre olan "/ui" ifadesi der ki
ui ile ile başlayan herhangi bir istek gelirse yani GET http://127.0.0.1:8000/ui/ gibi bir istek gelirse bunları endpointler
değil StaticFiles cevaplasın der.StaticFiles ifadesi bir dosyayı web üzerinden servis et der.örneğin 
GET http://127.0.0.1:8000/ui/app.js ifadesi web üzerinden açılır.
StaticFiles içerisindeki directory,bu UI_DIR yolunu string ifadesine çevirir,çünkü bu StaticFiles ifadesi string olarak veri 
bekler.html=True ifadesi yanlışlıkla /ui gibi istekler gelirse bunları da /ui/ gibi değerlendirir.
name=ui ifadesi ise önemli değildir ama debugging işlemlerinde işimize yaramaktadır.
"""

@app.get("/")
def root():
    return RedirectResponse(url="/ui/")
"""
@app.get("/") ifadesi tarayıcıya veya bir client'a istek atarsa(http://localhost:8000) aşağıdaki metot çalışsın demektir.
örnek vermek gerekirse aslında benim projemin ana sayfası admin sayfası ve de admin sayfasını açan url de
http://localhost:8000/ui/ 'dir ama alışkanlık gereği http://localhost:8000 yazılabileceğinden biz oto olarak bu yanlış 
girilen url'yi http://localhost:8000/ui/ url'sine yönlendiriyoruz.
"""

@app.get("/healthz")
def healthz():
    return {"ok": True}
"""
bu kısım sunucuyu ayağa kaldırdıktan sonra api çalışıyor mu diye kontrol ettimiz kısımdır.
Sunucuyu çağırdıktan sonra tarayıcının adres kısmına ilgili komutu girdikten sonra ekranda ok: true yazısı çıkıyorsa api'miz 
çalışıyor demektir.(http://127.0.0.1:8000/healthz)
"""

app.include_router(admin.router, prefix="/admin/v1", tags=["admin"])    #admin router'ı bağlandı.

app.include_router(sdk.router, prefix="/sdk/v1", tags=["sdk"])
"""
SDK router'ı bağlama
Ayrı bir dosyada tanımladığın sdk router’ını ana uygulamaya bağlıyor.
Bu sayede:
/sdk/v1/flags gibi endpoint’ler aktif oluyor.
Swagger’da “sdk” diye ayrı bir grup altında görünüyor.
Özet: “Feature flags’i dış dünyaya servis eden asıl endpoint’leri” bu satır projeye ekliyor.
"""