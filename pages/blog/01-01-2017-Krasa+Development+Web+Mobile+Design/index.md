---
author: "abe"
path: "/index.html"
photoURL: "https://media.licdn.com/mpr/mpr/shrinknp_400_400/p/6/005/096/07c/1427c21.jpg"
title: "Krasa Development: Web, Mobile, Design"
previewText: "This is the preview text"
---
# Introducing Krasa

Krasa is a San Francisco based digital Design and Development company. We specialize in designing and building fast, reliable, and sexy mobile apps, websites, and other digital experiences.

asf;dlk
```
<Head> </Head>
```
# Webpack — The Confusing Parts
Webpack is the leading module bundler for React and Redux apps. I think folks using Angular 2 and other frameworks are also using it a lot these days.

When I first saw a Webpack config file, it looked very alien-y 👽 and confusing 😱. After playing around with it for some time, I now think that it is because Webpack just has a unique syntax and new philosophies that may cause confusion in the beginning. Incidentally, these philosophies are also responsible for making it so popular.

*Since it’s confusing to get started, I thought I’ll write a few posts that’ll hopefully make it easy for others to get started and use it’s powerful features. Here is the 1st installment.*

## Webpack’s Core Philosophy

Two core philosophies of Webpack are:

1. **Everything is a module **— Just like JS files can be “modules”, everything else (CSS, Images, HTML) can also be modules. That is, you can require(“myJSfile.js”) or require(“myCSSfile.css”). This mean we can split any artifact into smaller manageable pieces, reuse them and so on.
2. **Load only “what” you need and “when” you need** — Typically module bundlers take all the modules and generate a large single output “bundle.js” file. But in many real-world apps, this “bundle.js” could be 10MB-15MB and could take forever to load! So Webpack has various features to split your code and generate multiple “bundle” files, and also load parts of the app asynchronously so that you just load what you need and when you need it.

OK, Let’s take a look at various “confusing” parts.

## 1. Development Vs Production
First thing to be aware of is that Webpack has tons of features. Some are for “Development-only”, some others are for “Production-only” and some are for both “Production-and-Development”.

> Note: You can click on the pictures to zoom and read.

![Abe Clark](./Abe_Clark.png)
A sample dev v/s prod Webpack files

Typically most projects use so many features that they usually have two large Webpack config files.
And to create bundles you’ll write scripts in the package.json like so:

```
 “scripts”: {
  //npm run build to build production bundles
  “build”: “webpack --config webpack.config.prod.js”,
  //npm run dev to generate development bundles and run dev. server
  “dev”: “webpack-dev-server”
 }
 ```
