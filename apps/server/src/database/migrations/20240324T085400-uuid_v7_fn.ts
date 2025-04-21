import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    /*
     * MIT License - Copyright (c) 2023-2024 Fabio Lima
     * Source:  https://gist.githubusercontent.com/fabiolimace/515a0440e3e40efeb234e12644a6a346/
     */
    CREATE OR REPLACE FUNCTION gen_uuid_v7() RETURNS uuid AS $$
        declare
              v_time numeric := null;
      
              v_unix_t numeric := null;
              v_rand_a numeric := null;
              v_rand_b numeric := null;
      
              v_unix_t_hex varchar := null;
              v_rand_a_hex varchar := null;
              v_rand_b_hex varchar := null;
      
              v_output_bytes bytea := null;
              
              c_milli_factor numeric := 10^3::numeric;  -- 1000
              c_micro_factor numeric := 10^6::numeric;  -- 1000000
              c_scale_factor numeric := 4.096::numeric; -- 4.0 * (1024 / 1000)
              
              c_version bit(64) := x'0000000000007000'; -- RFC-4122 version: b'0111...'
              c_variant bit(64) := x'8000000000000000'; -- RFC-4122 variant: b'10xx...'

        begin
              v_time := extract(epoch from clock_timestamp());
              
              v_unix_t := trunc(v_time * c_milli_factor);
              v_rand_a := ((v_time * c_micro_factor) - (v_unix_t * c_milli_factor)) * c_scale_factor;
              v_rand_b := random()::numeric * 2^62::numeric;
              
              v_unix_t_hex := lpad(to_hex(v_unix_t::bigint), 12, '0');
              v_rand_a_hex := lpad(to_hex((v_rand_a::bigint::bit(64) | c_version)::bigint), 4, '0');
              v_rand_b_hex := lpad(to_hex((v_rand_b::bigint::bit(64) | c_variant)::bigint), 16, '0');
              
              v_output_bytes := decode(v_unix_t_hex || v_rand_a_hex || v_rand_b_hex, 'hex');
    
              return encode(v_output_bytes, 'hex')::uuid;
              
              v_output_bytes := decode(v_unix_t_hex || v_rand_a_hex || v_rand_b_hex, 'hex');
    
              return encode(v_output_bytes, 'hex')::uuid;
     end $$ LANGUAGE plpgsql;`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP FUNCTION gen_uuid_v7`.execute(db);
}
