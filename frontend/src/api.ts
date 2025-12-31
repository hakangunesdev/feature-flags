export interface ApiResult<T = any> {
    ok: boolean;
    status: number;
    data: T;
    timeMs?: number;
}

export const apiCall = async (      //her bir butonda tek tek api çağrısı yapmak yerine bu apicall sayesinde tek bir kez api çağrısı yapılıyor.
    path: string,
    method: string = 'GET',
    body?: any,
    headers: Record<string, string> = {}
): Promise<ApiResult> => {

    const url = path.startsWith('/') ? path : `/${path}`;       //yolunun / ile başlaması koşul olarak yetiyor,böylece react kodu yol şart koşmadan yani http://localhost:5173/ şartını koşmadan direkt backend ile bağlantı kurabiliyor.

    try {
        const opts: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
        };
        if (body) opts.body = JSON.stringify(body);

        const start = performance.now();
        const res = await fetch(url, opts);                     //redis'in çalıştığını göstermek için süre değişkenleri
        const end = performance.now();

        let data;
        try { data = await res.json(); } catch { data = {}; }

        return {
            ok: res.ok,
            status: res.status,
            data,
            timeMs: Math.round(end - start)
        };
    } catch (err: any) {
        return { ok: false, status: 0, data: { error: err.message }, timeMs: 0 };
    }
};
