# rpc-test Users.GetDetails '[123,456]'
# rpc-test Users.SetDetails '{"name":"Joe"}'
# Authorization: {"uid":"1234567812345678"}
rpc-test() {
  curl -v $3 -X POST -d $2 localhost:3921/rpc/$1;
  echo "";
}
