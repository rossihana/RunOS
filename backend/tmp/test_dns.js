const dns = require('dns');

function resolve(host) {
  dns.lookup(host, (err, address, family) => {
    if (err) {
      console.error(`Lookup failed for ${host}:`, err.message);
    } else {
      console.log(`Lookup success for ${host}: ${address} (IPv${family})`);
    }
  });
}

resolve('aws-1-ap-northeast-2.pooler.supabase.com');
resolve('db.tagdkjncplvuudjjklhm.supabase.co');
resolve('aws-0-ap-northeast-2.pooler.supabase.com');
