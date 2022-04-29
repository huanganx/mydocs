const http = require('http')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// 递归删除目录
function deleteFolderRecursive (path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function (file) {
      const curPath = path + '/' + file
      if (fs.statSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath)
      } else {
        // delete file
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(path)
  }
}

const resolvePost = (req) =>
  new Promise((resolve) => {
    let chunk = ''
    req.on('data', (data) => {
      chunk += data
    })
    req.on('end', () => {
      resolve(JSON.parse(chunk))
    })
  })

http
  .createServer(async (req, res) => {
    console.log('receive request')
    console.log(req.url)
    if (req.method === 'POST' && req.url === '/') {
      const data = await resolvePost(req)
      const projectDir = path.resolve(`./${data.repository.name}`)
      deleteFolderRecursive(projectDir)

      // 拉取仓库最新代码  data.repository.name 即 webhook 中记录仓库名的属性
      execSync(
        `git clone https://github.com/huanganx/${data.repository.name}.git ${projectDir}`,
        {
          stdio: 'inherit'
        }
      )
      // 复制 Dockerfile 到项目目录
      fs.copyFileSync(
        path.resolve('./Dockerfile'),
        path.resolve(projectDir, './Dockerfile')
      )

      // 复制 .dockerignore 到项目目录
      fs.copyFileSync(
        path.resolve(__dirname, './.dockerignore'),
        path.resolve(projectDir, './.dockerignore')
      )

      // 创建 docker 镜像
      execSync(`docker build . -t ${data.repository.name}-image:latest `, {
        stdio: 'inherit',
        cwd: projectDir
      })

      // 销毁 docker 容器
      execSync(
        `docker ps -a -f 'name=^${data.repository.name}-container' --format='{{.Names}}' | xargs -r docker stop | xargs -r docker rm`,
        {
          stdio: 'inherit'
        }
      )

      // 创建 docker 容器  -- 这里使用了服务器的8888端口
      execSync(
        `docker run -d -p 8889:80 --name ${data.repository.name}-container  ${data.repository.name}-image:latest`,
        {
          stdio: 'inherit'
        }
      )

      console.log('deploy success')
    }
    res.end('ok')
  })
  .listen(8089, () => {
    console.log('server is ready')
  })
