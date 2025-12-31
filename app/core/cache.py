# app/core/cache.py
import json
import os
from typing import Any, Optional, Iterable
from redis.asyncio import Redis
from redis import Redis as RedisSync
from app.core.settings import settings
"""
normalde /sdk/v1/flags endpoint'i şunu yapar:
-Env+SDK key alıyor,DB'den flag+variant+rule bilgilerini çekiyor ve bunları tek bir json olarak dönderiyor.
-ama yukarıdaki işlem çok iş yükü barındırıyor,her bir istek için db'ye 3-4 sorgu atılıyor.
-işte yukardaki iş yükünü azaltmak için cache katmanını ekledik,bu katman /sdk/v1/flags endpointi çalıştığında ilk olarak DB'den bilgileri normal topluyor,sonrasında ise Redis'e kaydediyor.bu sayede yeni sorgular atıldığında 
DB'ye gidilmiyor,yalnızca Redis'ten hazır JSON'u çekiliyor.
""" 

# ---- Cache key helpers (tek yerden yönet) ----
def flags_cache_key(project_id: int, environment_id: int) -> str:
    return f"ff:flags:{project_id}:{environment_id}"
"""
ff:flags bu bilginin bir feature flags flags'i cevabı olduğunu belirtir
,yani prefix bir ifadedir,geri kalan bilgiler ise proje id'si ve env id'sidir.
"""

def flags_cache_match(project_id: int) -> str:
    return f"ff:flags:{project_id}:*"
"""
herhangi bir güncelleme işlemi sonrasında cache'deki bilgileri sorun çıkmasın diye silmem gerekiyor,bu metotu da yapısına girilen id'ye özgü olarak bir tane key değeri döndermektedir.
"""

def cfg_cache_key(project_id: int, environment_id: Optional[int]) -> str:
    scope = "global" if environment_id is None else str(environment_id)
    return f"ff:cfg:{project_id}:{scope}"
"""
bu da config silmek için oluşturulmuş bir metottur.
"""




_redis: Optional[Redis] = None
"""
burda global bir değişken olarak _redis oluşturduk çünkü aşağıdaki metotların her birinde tek tek Redis.from_url() demekle uğraşmayalım diye.
değerini aşağıdaki _get_client() metotundan alacak.
"""

_redis_sync: Optional[RedisSync] = None
"""
sync olarak bir değişken oluşturduk,redis bağlantısı için artık bunu kullanacağız.
değerini aşağıdai _get_client_sync() metotundan alacak.
"""

async def _get_client() -> Optional[Redis]:
    global _redis
    if _redis is None:
        try:
            _redis = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            await _redis.ping()
        except Exception:
            _redis = None
    return _redis

def _get_client_sync() -> Optional[RedisSync]:
    global _redis_sync
    if _redis_sync is None:
        try:
            _redis_sync = RedisSync.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            _redis_sync.ping()
        except Exception:
            _redis_sync = None
    return _redis_sync
"""
-Optional[RedisSync] ifadesi der ki ben sana farklı değerler dönderebilirim,yani şunu demek istiyor,eğer ki redis ile bağlantı kurma aşamasında herhangi bir sorun ile karşılaşırsam except ile sana boş bir değer döndereririm,bu sayede redis none 
olduğu için redis üzerinden değil de bilgiler sorunsuz bir şekilde db'den çekilmeye devam edecek,eğer ki hata çıkmazsa bilgiler redis de varsa redis üzerinden çekilmeye devam edilecek.
-bu oluşturduğumuz bağlantıyı global tanımlanmış olan _redis_sync değişkenine atıyoruz.
-eğer ki _redis_sync boş ise yani herhangi bir bağlantı kurulmamışsa if içerisine girerve RedisSync.from_url() ile bağlantı kurulmaya çalışılır.bu parametreler içindeki settings.REDIS_URL ile settings içerisindeki url ile redis ile bağlantı kurulması
sağlanır,decode_responses=True ifadesi ile de normalde bilgileri byte byte dönen redis'in bilgileri string olarak dönmesi sağlandı,socket_connect_timeout=1 ifadesi ile de redis ile bağlantı kurulurken max 1 sn beklenmesi sağlandı,1 sn içerisinde
bağlantı kurulmazsa bilgi db'den çekilecek,socket_timeout=1 ifadesi ile de redis'den bilginin 1 sn içerisinde çekilmesi bekleniyor,yine aynı şekilde bilgi 1 sn içerisinde redis üzerinden alınmazsa db'den çekilmesi sağlandı.
-_redis_sync.ping() ifadesi ile de redis bağlantısının gerçekten kurulu olup olmadığını kontrol ediyoruz.Eğer hata olursa except' düşmesini sağlıyoruz.
-except Exception ile de hata ile karşılaşırsak _redis_sync ifadesini none olarak geriye dönderiyoruz.
-return ile de bu redis bağlantısını geriye dönderiyoruz.
"""


async def cache_get_json(key: str):
    client = await _get_client()
    if not client:
        return None
    try:
        raw = await client.get(key)
        return None if raw is None else json.loads(raw)
    except Exception:
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int = 120):
    client = await _get_client()
    if not client:
        return
    try:
        await client.setex(key, ttl_seconds, json.dumps(value))
    except Exception:
        pass



def invalidate_project_sync(project_id: int) -> None:
    if os.getenv("REDIS_ENABLED", "0") != "1":
        return

    r = _get_client_sync()
    if not r:
        return

    try:
        pipe = r.pipeline()
        found_any = False

        patterns = [
            flags_cache_match(project_id), 
            f"ff:cfg:{project_id}:*"     
        ]

        for pattern in patterns:
            for k in r.scan_iter(match=pattern):
                pipe.delete(k)
                found_any = True

        if found_any:
            pipe.execute()

    except Exception:
        pass



"""
-metotun en başındaki ifade redis var mı yok mu kontrolunu yapıyor,eğer ki redis varsa içine giriyor,eğer ki yoksa return'la çıkarak içerdeki kod yapılarına girmesini engelleyerek perfonmans kazanıyor.
-bu metotumuzda admin herhangi bir güncelleme işlemi veya silme işlemi gibi bir işlem yaptığında kullanıcılar bu değişiklikleri 120 sn gibi bir süre sonra görmesinler yani direkt yapılan dğişiklikleri görsünler diye yapılan bir metottur.
-önceki kod yapımızda bu metot sync olduğu için global değişken olan _redis: Optional[Redis] = None değişkenini kullanamaıyor,ve tekrar tekrar redis bağlantısı oluşturuyordu,bu da iş parçacığı yükünü arttırıyor.bunu azaltmak için yukarıdaki kod 
yapısında sync_redis değişkenini oluşturdum ve _get_client_sync() metotunu çağırdığım zaman bu değişkene redis bağlantısını yolladım.şimdi kendi kod yapıma geçersem:
öncelikle aldığım redis bağlantısını r değişkenine yolladım.sonrasında bağlantı kurulu mu değil mi kontrolunu yaptım.Ardından project_id'li key'i pattern değişkenine yollladım.bir sonraki satırda ise pipe = r.pipeline() ifadesi yer alıyor,bu 
satır sayesinde yani pipeline() ifadesi sayesinde cache'de yapacağımız değişikliklerde sürekli git gel yapmak yerine bütün sorguları toplayıp tek sefer de git gel yapmayı planlıyoruz,bu yüzden bütün sorguları toplaması için pipeline() metotunu 
kullanıyoruz.ardından eğer ki herhangi bir cache işlemi yapmayacaksak bunu found_any değişkenine bildiriyoruz,bu şekilde herhangi bir sorgu yapılmayacaksa boş execute yapmamaış olacağız.
for döngüsünde ise cache'deki keyleri dolaşıyoruz.eğer ki key varsa bu keyin silinmesi talimatını pipe'a ekliyoruz ve found_any değişkenini true yapıyoruz.sonrasında ise bir sorgu varsa bunu if ile kontrol edip çalıştırıyoruz.
-son satırda ise eğer ki bir hata oluşursa hiçbir şey yapmadan geç diyoruz(zaten bir cache'nin ömrü 120 sn olduğu için geç de olsa bu bilgiler farklı yerlerde görünecektir.)
"""  
