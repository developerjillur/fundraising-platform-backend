-- MySQL dump 10.13  Distrib 8.0.35, for macos13 (arm64)
--
-- Host: localhost    Database: fundraising_db
-- ------------------------------------------------------
-- Server version	8.0.35

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `fundraising_db`
--

/*!40000 DROP DATABASE IF EXISTS `fundraising_db`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `fundraising_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `fundraising_db`;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','moderator') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_051db7d37d478a69a7432df147` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES ('f0600db6-2d09-4274-86c3-053b6d1e45b3','developerjillur@gmail.com','$2a$10$rHheaSbT1IE2uNX8CITrDOsmWPf28ddlXWc3BLZfRmfd/d58uqUZe','admin','2026-03-07 02:28:33.836683');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_stats`
--

DROP TABLE IF EXISTS `customer_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_stats` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_spent_cents` bigint NOT NULL DEFAULT '0',
  `photo_purchase_count` int NOT NULL DEFAULT '0',
  `merch_purchase_count` int NOT NULL DEFAULT '0',
  `grand_prize_entries` int NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_0f9f0113840964210314a0049b` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_stats`
--

LOCK TABLES `customer_stats` WRITE;
/*!40000 ALTER TABLE `customer_stats` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_templates`
--

DROP TABLE IF EXISTS `email_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_templates` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `body_html` text COLLATE utf8mb4_unicode_ci,
  `body_text` text COLLATE utf8mb4_unicode_ci,
  `enabled` tinyint NOT NULL DEFAULT '1',
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `variables` json DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_732dadd7cca4fe8a08228e3ac7` (`template_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_templates`
--

LOCK TABLES `email_templates` WRITE;
/*!40000 ALTER TABLE `email_templates` DISABLE KEYS */;
INSERT INTO `email_templates` VALUES ('0c910c49-46bc-4b27-bf9a-a0aed3bb29db','photo_displayed','Photo Displayed on Stream',NULL,'Your photo was just on stream! 📸','<h1>{{name}}, your photo was displayed!</h1><p>Your photo just appeared on the live stream.</p>','',1,'stream','[\"name\", \"screenshot_url\"]','2026-03-07 02:28:33.856873','2026-03-07 02:28:33.856873'),('0e912236-dbbf-42fe-8fdc-5d455530ab02','photo_purchased','Photo Purchase Confirmation',NULL,'Your photo is in the queue! 🎉','<h1>Thanks {{name}}!</h1><p>Your {{package_type}} photo package ({{amount}}) has been confirmed. Your photo will appear on the live stream soon!</p>','',1,'purchase','[\"name\", \"package_type\", \"amount\"]','2026-03-07 02:28:33.855504','2026-03-07 02:28:33.855504'),('2575171e-a265-4c10-8633-dd3fab4ff3c8','merch_order_confirmation','Merchandise Order Confirmation',NULL,'Order Confirmed — {{order_number}}','<h1>Thanks {{name}}!</h1><p>Your order {{order_number}} for {{amount}} has been confirmed.</p>','',1,'purchase','[\"name\", \"order_number\", \"amount\"]','2026-03-07 02:28:33.857601','2026-03-07 02:28:33.857601'),('45a37c27-f790-43c1-abff-d01da2fdd374','merch_shipped','Order Shipped',NULL,'Updated Subject Test','<h1>{{name}}, your order is on its way!</h1><p>Track: {{tracking_url}}</p>','',1,'fulfillment','[\"name\", \"order_number\", \"tracking_url\"]','2026-03-07 02:28:33.858102','2026-03-07 03:31:41.000000'),('d2ff1e1c-8300-4d0a-83c0-d967c80a3313','photo_rejected','Photo Rejected',NULL,'Your photo submission was not approved','<h1>Hi {{name}}</h1><p>Unfortunately your photo was not approved. Reason: {{reason}}</p>','',1,'moderation','[\"name\", \"reason\", \"email\"]','2026-03-07 02:28:33.859230','2026-03-07 02:28:33.859230'),('f9159824-ecd9-4561-ba3b-c15c21171519','payment_failed','Payment Failed',NULL,'Payment issue with your order','<h1>Hi {{name}}</h1><p>Your payment could not be processed. Please try again.</p>','',1,'payment','[\"name\", \"email\"]','2026-03-07 02:28:33.858643','2026-03-07 02:28:33.858643');
/*!40000 ALTER TABLE `email_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fundraising_stats`
--

DROP TABLE IF EXISTS `fundraising_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fundraising_stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `total_raised_cents` bigint NOT NULL DEFAULT '0',
  `goal_amount_cents` bigint NOT NULL DEFAULT '200000000',
  `supporter_count` int NOT NULL DEFAULT '0',
  `merch_order_count` int NOT NULL DEFAULT '0',
  `photos_displayed` int NOT NULL DEFAULT '0',
  `current_viewer_count` int NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fundraising_stats`
--

LOCK TABLES `fundraising_stats` WRITE;
/*!40000 ALTER TABLE `fundraising_stats` DISABLE KEYS */;
INSERT INTO `fundraising_stats` VALUES (1,1000,200000000,1,0,0,0,'2026-03-07 02:28:33.765445','2026-03-07 04:01:04.000000');
/*!40000 ALTER TABLE `fundraising_stats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grand_prize_entries`
--

DROP TABLE IF EXISTS `grand_prize_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grand_prize_entries` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entry_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_cents` int NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grand_prize_entries`
--

LOCK TABLES `grand_prize_entries` WRITE;
/*!40000 ALTER TABLE `grand_prize_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `grand_prize_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `merchandise`
--

DROP TABLE IF EXISTS `merchandise`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `merchandise` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price_cents` int NOT NULL,
  `image_url` text COLLATE utf8mb4_unicode_ci,
  `printful_product_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `printful_variant_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `variants` json DEFAULT NULL,
  `stock_quantity` int DEFAULT NULL,
  `active` tinyint NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `merchandise`
--

LOCK TABLES `merchandise` WRITE;
/*!40000 ALTER TABLE `merchandise` DISABLE KEYS */;
INSERT INTO `merchandise` VALUES ('44f8c536-21c5-420b-99b6-66c24afcf90a','Crop Hoodie',NULL,4600,'https://files.cdn.printful.com/files/d65/d65e5378cb7cc6b234e4e287dd632f54_preview.png','422182884',NULL,'[{\"id\": 5219435490, \"name\": \"Crop Hoodie / S\", \"variant_id\": 9648, \"retail_price\": \"54.50\"}, {\"id\": 5219435491, \"name\": \"Crop Hoodie / M\", \"variant_id\": 9649, \"retail_price\": \"54.50\"}, {\"id\": 5219435492, \"name\": \"Crop Hoodie / L\", \"variant_id\": 9650, \"retail_price\": \"54.50\"}, {\"id\": 5219435493, \"name\": \"Crop Hoodie / XL\", \"variant_id\": 9651, \"retail_price\": \"54.50\"}, {\"id\": 5219435495, \"name\": \"Crop Hoodie / 2XL\", \"variant_id\": 9652, \"retail_price\": \"46.00\"}]',NULL,1,0,'2026-03-07 04:05:22.580841','2026-03-07 04:05:22.580841'),('af420beb-4178-4cfa-8591-345808115f3d','Unisex t-shirt',NULL,1600,'https://files.cdn.printful.com/files/ddc/ddc99c5484f5b76e54e2320a07a40dbd_preview.png','422182785',NULL,'[{\"id\": 5219434587, \"name\": \"Unisex t-shirt / XS\", \"variant_id\": 9575, \"retail_price\": \"16.00\"}, {\"id\": 5219434588, \"name\": \"Unisex t-shirt / S\", \"variant_id\": 8923, \"retail_price\": \"16.00\"}, {\"id\": 5219434589, \"name\": \"Unisex t-shirt / M\", \"variant_id\": 8924, \"retail_price\": \"16.00\"}, {\"id\": 5219434590, \"name\": \"Unisex t-shirt / L\", \"variant_id\": 8925, \"retail_price\": \"16.00\"}, {\"id\": 5219434591, \"name\": \"Unisex t-shirt / XL\", \"variant_id\": 8926, \"retail_price\": \"16.00\"}, {\"id\": 5219434592, \"name\": \"Unisex t-shirt / 2XL\", \"variant_id\": 8927, \"retail_price\": \"18.50\"}, {\"id\": 5219434593, \"name\": \"Unisex t-shirt / 3XL\", \"variant_id\": 8928, \"retail_price\": \"20.50\"}, {\"id\": 5219434594, \"name\": \"Unisex t-shirt / 4XL\", \"variant_id\": 8929, \"retail_price\": \"23.00\"}, {\"id\": 5219434595, \"name\": \"Unisex t-shirt / 5XL\", \"variant_id\": 12878, \"retail_price\": \"26.00\"}]',NULL,1,0,'2026-03-07 04:05:23.165396','2026-03-07 04:05:23.165396'),('f78ccad1-a368-43cc-a81d-aaa444f044fb','Dad hat',NULL,2200,'https://files.cdn.printful.com/files/a72/a72d8d68515a52d37fcb3283bff9ca9f_preview.png','422182736',NULL,'[{\"id\": 5219434321, \"name\": \"Dad hat\", \"variant_id\": 7853, \"retail_price\": \"22.00\"}]',NULL,1,0,'2026-03-07 04:05:23.611617','2026-03-07 04:05:23.611617');
/*!40000 ALTER TABLE `merchandise` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `merchandise_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variant_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `unit_price_cents` int NOT NULL,
  `total_cents` int NOT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_145532db85752b29c57d2b7b1f1` (`order_id`),
  KEY `FK_912bf963c3541820b876f233015` (`merchandise_id`),
  CONSTRAINT `FK_145532db85752b29c57d2b7b1f1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `FK_912bf963c3541820b876f233015` FOREIGN KEY (`merchandise_id`) REFERENCES `merchandise` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_number` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shipping_address` json DEFAULT NULL,
  `subtotal_cents` int DEFAULT NULL,
  `shipping_cents` int DEFAULT NULL,
  `total_cents` int NOT NULL DEFAULT '0',
  `payment_status` enum('pending','completed','failed','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `stripe_checkout_session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_payment_intent_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `printful_order_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fulfillment_status` enum('pending','submitted','in_production','shipped','delivered','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `tracking_number` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_url` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_75eba1c6b1a66b09f2a97e6927` (`order_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES ('6517c01e-be13-4e6d-8dd6-5fa66c8dd3ac','ORD-1772832721233-E6BK','Swagger Test','swagger@test.com',NULL,0,NULL,0,'pending',NULL,NULL,NULL,'pending',NULL,NULL,'2026-03-07 03:32:01.234623','2026-03-07 03:32:01.000000');
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `photo_packages`
--

DROP TABLE IF EXISTS `photo_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `photo_packages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price_cents` int NOT NULL,
  `display_duration_seconds` int NOT NULL,
  `has_badge` tinyint NOT NULL DEFAULT '0',
  `badge_image_url` text COLLATE utf8mb4_unicode_ci,
  `active` tinyint NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `stripe_price_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_a14f3d9bc5b9524f7bc40783e0` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `photo_packages`
--

LOCK TABLES `photo_packages` WRITE;
/*!40000 ALTER TABLE `photo_packages` DISABLE KEYS */;
INSERT INTO `photo_packages` VALUES ('70406b76-32f1-41cd-a29f-f2f8ff2c942d','standard','Standard','Your photo displayed on the live stream',1000,10,0,NULL,1,1,NULL,'2026-03-07 02:28:33.841183','2026-03-07 02:28:33.841183'),('df00d21f-d0cd-4831-a940-f58fb0744790','premium','Premium','Extended display time with a premium badge overlay',2500,30,1,NULL,1,2,NULL,'2026-03-07 02:28:33.842230','2026-03-07 02:28:33.842230');
/*!40000 ALTER TABLE `photo_packages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `site_settings`
--

DROP TABLE IF EXISTS `site_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `site_settings` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `site_settings`
--

LOCK TABLES `site_settings` WRITE;
/*!40000 ALTER TABLE `site_settings` DISABLE KEYS */;
INSERT INTO `site_settings` VALUES ('faq_enabled','true',NULL,'features','2026-03-07 02:28:33.851972','2026-03-07 02:28:33.851972'),('fundraising_goal_cents','200000000',NULL,'general','2026-03-07 02:28:33.848091','2026-03-07 02:28:33.848091'),('grand_prize_enabled','true',NULL,'features','2026-03-07 02:28:33.852566','2026-03-07 02:28:33.852566'),('hero_cta_text','GET YOUR PHOTO — $10',NULL,'general','2026-03-07 02:28:33.847092','2026-03-07 02:28:33.847092'),('hero_headline','The Last McDonalds Burger',NULL,'general','2026-03-07 02:28:33.844656','2026-03-07 03:13:43.000000'),('hero_subheadline','Be Part of History',NULL,'general','2026-03-07 02:28:33.845937','2026-03-07 02:28:33.845937'),('livestream_enabled','true',NULL,'features','2026-03-07 02:28:33.850879','2026-03-07 02:28:33.850879'),('merch_enabled','true',NULL,'features','2026-03-07 02:28:33.851596','2026-03-07 02:28:33.851596'),('moderation_enabled','false',NULL,'integrations','2026-03-07 02:28:33.853917','2026-03-07 02:28:33.853917'),('photo_gallery_enabled','true',NULL,'features','2026-03-07 02:28:33.853075','2026-03-07 02:28:33.853075'),('printful_api_key','YOUR_PRINTFUL_API_KEY',NULL,'general','2026-03-07 03:59:28.451337','2026-03-07 04:00:20.000000'),('printful_connected','true',NULL,'general','2026-03-07 03:59:28.446417','2026-03-07 03:59:28.446417'),('printful_store_id','17802193',NULL,'general','2026-03-07 03:59:28.452889','2026-03-07 04:00:20.000000'),('resend_api_key','re_BMB44spS_BqpHK6DGRLbCQ35vwAc7RExx',NULL,'general','2026-03-07 04:00:40.588243','2026-03-07 04:00:40.588243'),('settings','[object Object]',NULL,'general','2026-03-07 03:55:41.909193','2026-03-07 03:57:04.000000'),('site_title','The Last McDonald\'s Burger',NULL,'general','2026-03-07 02:28:33.843599','2026-03-07 02:28:33.843599'),('social_proof_enabled','true',NULL,'features','2026-03-07 02:28:33.853443','2026-03-07 02:28:33.853443'),('stream_display_interval','10',NULL,'stream','2026-03-07 02:28:33.849767','2026-03-07 02:28:33.849767'),('stream_queue_paused','false',NULL,'stream','2026-03-07 02:28:33.849259','2026-03-07 03:31:41.000000'),('stripe_connected','true',NULL,'integrations','2026-03-07 02:28:33.854508','2026-03-07 03:23:04.000000'),('stripe_publishable_key','YOUR_STRIPE_PUBLISHABLE_KEY',NULL,'general','2026-03-07 03:23:04.006321','2026-03-07 03:23:04.006321'),('stripe_secret_key','YOUR_STRIPE_SECRET_KEY',NULL,'general','2026-03-07 03:23:04.018113','2026-03-07 03:23:04.018113'),('test_key','test_val',NULL,'general','2026-03-07 03:31:08.599503','2026-03-07 03:31:08.599503'),('youtube_api_key','AIzaSyB9KDpUbQTefkeOvReKPth9emzbL5VQKmM',NULL,'general','2026-03-07 04:01:04.471394','2026-03-07 04:01:04.471394'),('youtube_video_id','is0J3adpXsA',NULL,'stream','2026-03-07 02:28:33.848851','2026-03-07 04:01:04.000000');
/*!40000 ALTER TABLE `site_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stream_events`
--

DROP TABLE IF EXISTS `stream_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stream_events`
--

LOCK TABLES `stream_events` WRITE;
/*!40000 ALTER TABLE `stream_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `stream_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stream_queue`
--

DROP TABLE IF EXISTS `stream_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stream_queue` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supporter_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_storage_path` text COLLATE utf8mb4_unicode_ci,
  `package_type` enum('standard','premium') COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_duration_seconds` int NOT NULL,
  `has_badge` tinyint NOT NULL DEFAULT '0',
  `queue_position` int NOT NULL,
  `status` enum('waiting','displaying','displayed','skipped') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'waiting',
  `estimated_display_at` datetime DEFAULT NULL,
  `display_started_at` datetime DEFAULT NULL,
  `display_ended_at` datetime DEFAULT NULL,
  `screenshot_url` text COLLATE utf8mb4_unicode_ci,
  `total_screen_time_seconds` int NOT NULL DEFAULT '0',
  `view_count` int NOT NULL DEFAULT '0',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `FK_dc66e4284f547c5d813610c1f33` (`supporter_id`),
  CONSTRAINT `FK_dc66e4284f547c5d813610c1f33` FOREIGN KEY (`supporter_id`) REFERENCES `supporters` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stream_queue`
--

LOCK TABLES `stream_queue` WRITE;
/*!40000 ALTER TABLE `stream_queue` DISABLE KEYS */;
/*!40000 ALTER TABLE `stream_queue` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supporters`
--

DROP TABLE IF EXISTS `supporters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supporters` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_url` text COLLATE utf8mb4_unicode_ci,
  `photo_storage_path` text COLLATE utf8mb4_unicode_ci,
  `package_type` enum('standard','premium') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount_cents` int NOT NULL DEFAULT '0',
  `display_duration_seconds` int DEFAULT NULL,
  `payment_status` enum('pending','completed','failed','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `stripe_checkout_session_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_payment_intent_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `moderation_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `moderation_reason` text COLLATE utf8mb4_unicode_ci,
  `display_status` enum('queued','displaying','displayed','skipped') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `estimated_display_at` datetime DEFAULT NULL,
  `displayed_at` datetime DEFAULT NULL,
  `display_screenshot_url` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supporters`
--

LOCK TABLES `supporters` WRITE;
/*!40000 ALTER TABLE `supporters` DISABLE KEYS */;
INSERT INTO `supporters` VALUES ('22eed696-622c-4155-ba5b-f84ece75a323','Test User','testuser@example.com','http://localhost:8080/uploads/photos/1772832363213-0a438bd2-fa8e-4ab6-a6be-c4f404a3f14b.jpg','uploads/photos/1772832363213-0a438bd2-fa8e-4ab6-a6be-c4f404a3f14b.jpg','standard',1000,10,'completed','cs_test_a1g3IEcQ9oy9mFtKUrHO5EdDmnd7E2hpQjork9psnppR3OcQIgyTrySJTh',NULL,'approved',NULL,NULL,NULL,NULL,NULL,'2026-03-07 03:26:03.226903','2026-03-07 03:31:41.000000'),('3e9a338b-47b5-4cb6-8ee6-c9d03047f579','Test','developerjillur@gmail.com','http://localhost:8080/uploads/photos/1772837132348-0f813ec2-aef9-4a54-b05d-acf37f5c7112.png','uploads/photos/1772837132348-0f813ec2-aef9-4a54-b05d-acf37f5c7112.png','premium',2500,30,'pending','cs_test_a1kLA7Vkcap0PSOQAf561IigmwEbE8uNSQd4qJv64uLg6qAGkd0smTmriG',NULL,'approved',NULL,NULL,NULL,NULL,NULL,'2026-03-07 04:45:32.397235','2026-03-07 04:45:33.000000'),('fd72c649-e03b-4241-a5ec-ed69a2622815','Swagger Test','swagger@test.com',NULL,NULL,NULL,1000,10,'pending','cs_test_a1Op6Sf4raRjCopisO98knHp0u5JwLws108EJI98sNLOjArGzo1wDLWNIM',NULL,'approved',NULL,NULL,NULL,NULL,NULL,'2026-03-07 03:31:59.984877','2026-03-07 03:32:01.000000');
/*!40000 ALTER TABLE `supporters` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-07  4:55:33
