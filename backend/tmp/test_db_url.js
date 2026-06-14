const parse = require('pg-connection-string').parse;
const conn = "postgresql://postgres.tagdkjncplvuudjjklhm:@Bulaipass46@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";
console.log(parse(conn));
